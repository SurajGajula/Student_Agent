import express, { Request, Response } from 'express'
import Stripe from 'stripe'
import { authenticateUser, AuthenticatedRequest } from './middleware/auth.js'
import { createClient } from '@supabase/supabase-js'
import '../load-env.js'

const router = express.Router()

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables')
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
})

// Initialize Supabase client for backend operations
const supabaseUrl = process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_SECRET_KEY')
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Create checkout session
router.post('/create-checkout-session', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const priceId = process.env.STRIPE_PRICE_ID_PRO
    if (!priceId) {
      return res.status(500).json({ error: 'Stripe price ID not configured' })
    }

    // Get user email from Supabase
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(req.userId)
    
    if (userError || !user) {
      console.error('Error fetching user:', userError)
      return res.status(500).json({ error: 'Failed to fetch user information' })
    }

    const customerEmail = user.email

    // Check if customer already exists in Stripe
    const existingCustomers = await stripe.customers.list({
      email: customerEmail,
      limit: 1,
    })

    let customerId: string | undefined
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id
      console.log(`Found existing Stripe customer ${customerId} for user ${req.userId}`)
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email: customerEmail,
        metadata: { userId: req.userId },
      })
      customerId = customer.id
      console.log(`Created new Stripe customer ${customerId} for user ${req.userId}`)
    }

    // Get origin from request headers for redirect URLs
    const origin = req.headers.origin || 'http://localhost:5173'

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/settings?success=true`,
      cancel_url: `${origin}/settings?canceled=true`,
      metadata: {
        userId: req.userId,
      },
    })

    res.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: errorMessage,
    })
  }
})

// Webhook handler (must use raw body for signature verification)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  console.log('Webhook received - checking signature...')
  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    console.error('Missing signature or webhook secret')
    return res.status(400).send('Missing signature or webhook secret')
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
    console.log(`Webhook event received: ${event.type} (ID: ${event.id})`)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId

        console.log('checkout.session.completed event:', {
          sessionId: session.id,
          userId,
          customer: session.customer,
          subscription: session.subscription,
          customerEmail: session.customer_email,
        })

        if (!userId) {
          console.error('No userId in checkout session metadata')
          break
        }

        // Retrieve full session object with expanded subscription
        let fullSession: Stripe.Checkout.Session
        try {
          fullSession = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ['subscription', 'customer'],
          })
        } catch (err) {
          console.error('Error retrieving full session:', err)
          fullSession = session
        }

        // Get customer ID - prefer expanded customer, then session.customer, then from subscription
        let customerId = typeof fullSession.customer === 'string' 
          ? fullSession.customer 
          : (fullSession.customer as Stripe.Customer)?.id

        const subscriptionId = typeof fullSession.subscription === 'string'
          ? fullSession.subscription
          : (fullSession.subscription as Stripe.Subscription)?.id

        if (!customerId && subscriptionId) {
          // Try to get customer from subscription
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId)
            customerId = subscription.customer as string
            console.log(`Retrieved customer ${customerId} from subscription ${subscriptionId}`)
          } catch (subError) {
            console.error('Error retrieving subscription:', subError)
          }
        }
        
        if (!customerId && session.customer_email) {
          // Create customer if doesn't exist
          try {
            const customer = await stripe.customers.create({
              email: session.customer_email,
              metadata: { userId },
            })
            customerId = customer.id
            console.log(`Created new Stripe customer ${customerId} for user ${userId}`)
          } catch (custError) {
            console.error('Error creating customer:', custError)
          }
        }
        
        if (!customerId) {
          console.error('Could not determine or create customer ID for user:', userId)
          throw new Error('Failed to get or create customer ID')
        }

        if (!subscriptionId) {
          console.error('No subscription ID found in session:', session.id)
          throw new Error('No subscription ID found')
        }

        // Get Pro plan ID from database
        const { data: proPlan, error: proPlanError } = await supabase
          .from('plans')
          .select('id')
          .eq('name', 'pro')
          .single()

        if (proPlanError || !proPlan) {
          console.error('Pro plan not found in database:', proPlanError)
          break
        }

        console.log(`Processing checkout.session.completed for user ${userId}, subscription: ${subscriptionId}, customer: ${customerId}`)

        // Check if user_usage record exists
        const { data: existingUsage, error: fetchError } = await supabase
          .from('user_usage')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error fetching user usage:', fetchError)
        }

        if (existingUsage) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('user_usage')
            .update({
              plan_id: proPlan.id,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)

          if (updateError) {
            console.error('Error updating user usage:', updateError)
            throw new Error(`Failed to update user usage: ${updateError.message}`)
          } else {
            console.log(`Successfully updated user ${userId} to Pro plan (subscription: ${subscriptionId})`)
          }
        } else {
          // Create new record with Pro plan
          const currentMonthStart = new Date()
          currentMonthStart.setDate(1)
          currentMonthStart.setHours(0, 0, 0, 0)

          const { error: insertError } = await supabase
            .from('user_usage')
            .insert({
              user_id: userId,
              plan_id: proPlan.id,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              tokens_used_this_month: 0,
              last_monthly_reset: currentMonthStart.toISOString().split('T')[0],
              updated_at: new Date().toISOString(),
            })

          if (insertError) {
            console.error('Error creating user usage record:', insertError)
            throw new Error(`Failed to create user usage record: ${insertError.message}`)
          } else {
            console.log(`Successfully created user usage record for user ${userId} with Pro plan (subscription: ${subscriptionId})`)
          }
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Find user by customer ID
        const { data: userUsage, error: findError } = await supabase
          .from('user_usage')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (findError || !userUsage) {
          console.error('User not found for customer:', customerId, findError)
          break
        }

        // Get free plan ID
        const { data: freePlan, error: freePlanError } = await supabase
          .from('plans')
          .select('id')
          .eq('name', 'free')
          .single()

        if (freePlanError || !freePlan) {
          console.error('Free plan not found:', freePlanError)
          break
        }

        // Update plan based on subscription status
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          // Keep Pro plan
          const { data: proPlan, error: proPlanError } = await supabase
            .from('plans')
            .select('id')
            .eq('name', 'pro')
            .single()

          if (proPlanError || !proPlan) {
            console.error('Pro plan not found:', proPlanError)
            break
          }

          const { error: updateError } = await supabase
            .from('user_usage')
            .update({
              plan_id: proPlan.id,
              stripe_subscription_id: subscription.id,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userUsage.user_id)

          if (updateError) {
            console.error('Error updating subscription:', updateError)
          }
        } else {
          // Downgrade to free
          const { error: updateError } = await supabase
            .from('user_usage')
            .update({
              plan_id: freePlan.id,
              stripe_subscription_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userUsage.user_id)

          if (updateError) {
            console.error('Error downgrading user:', updateError)
          } else {
            console.log(`Downgraded user ${userUsage.user_id} to Free plan`)
          }
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    res.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Webhook error details:', errorMessage, error instanceof Error ? error.stack : '')
    res.status(500).json({ error: 'Webhook processing failed', message: errorMessage })
  }
})

// Manual sync endpoint to check subscription status from Stripe and update database
router.post('/sync-subscription', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    console.log(`Syncing subscription for user ${req.userId}`)

    // Get user email
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(req.userId)
    
    if (userError || !user) {
      console.error('Error fetching user:', userError)
      return res.status(500).json({ error: 'Failed to fetch user information' })
    }

    // Find all customers with this email in Stripe
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    })

    if (customers.data.length === 0) {
      console.log(`No Stripe customer found for user ${req.userId}`)
      return res.json({ 
        success: false, 
        message: 'No subscription found',
        hasSubscription: false 
      })
    }

    const customer = customers.data[0]
    console.log(`Found Stripe customer ${customer.id} for user ${req.userId}`)

    // Get active subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    })

    if (subscriptions.data.length === 0) {
      // Check for any subscriptions (including trialing, past_due, etc.)
      const allSubscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        limit: 1,
      })

      if (allSubscriptions.data.length === 0) {
        console.log(`No subscriptions found for customer ${customer.id}`)
        return res.json({ 
          success: false, 
          message: 'No subscription found',
          hasSubscription: false 
        })
      }
    }

    const subscription = subscriptions.data.length > 0 
      ? subscriptions.data[0] 
      : (await stripe.subscriptions.list({ customer: customer.id, limit: 1 })).data[0]

    if (!subscription) {
      return res.json({ 
        success: false, 
        message: 'No subscription found',
        hasSubscription: false 
      })
    }

    console.log(`Found subscription ${subscription.id} with status ${subscription.status} for user ${req.userId}`)

    // Check if subscription is active or trialing
    const isActive = subscription.status === 'active' || subscription.status === 'trialing'

    // Get plan ID from database
    const planName = isActive ? 'pro' : 'free'
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id')
      .eq('name', planName)
      .single()

    if (planError || !plan) {
      console.error(`${planName} plan not found in database:`, planError)
      return res.status(500).json({ error: `Failed to find ${planName} plan` })
    }

    // Check if user_usage record exists
    const { data: existingUsage, error: fetchError } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', req.userId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching user usage:', fetchError)
      return res.status(500).json({ error: 'Failed to fetch user usage' })
    }

    const updateData: any = {
      plan_id: plan.id,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    }

    if (existingUsage) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('user_usage')
        .update(updateData)
        .eq('user_id', req.userId)

      if (updateError) {
        console.error('Error updating user usage:', updateError)
        return res.status(500).json({ error: 'Failed to update user usage', details: updateError.message })
      }
    } else {
      // Create new record
      const currentMonthStart = new Date()
      currentMonthStart.setDate(1)
      currentMonthStart.setHours(0, 0, 0, 0)

      const { error: insertError } = await supabase
        .from('user_usage')
        .insert({
          user_id: req.userId,
          ...updateData,
          tokens_used_this_month: 0,
          last_monthly_reset: currentMonthStart.toISOString().split('T')[0],
        })

      if (insertError) {
        console.error('Error creating user usage record:', insertError)
        return res.status(500).json({ error: 'Failed to create user usage record', details: insertError.message })
      }
    }

    console.log(`Successfully synced subscription for user ${req.userId} - plan: ${planName}`)
    res.json({ 
      success: true, 
      message: `Subscription synced - ${planName} plan`,
      planName,
      hasSubscription: isActive
    })
  } catch (error) {
    console.error('Error syncing subscription:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    res.status(500).json({
      error: 'Failed to sync subscription',
      message: errorMessage,
    })
  }
})

// Get subscription details endpoint
router.get('/subscription-details', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Get user_usage record to find subscription ID
    const { data: userUsage, error: fetchError } = await supabase
      .from('user_usage')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('user_id', req.userId)
      .single()

    if (fetchError || !userUsage || !userUsage.stripe_subscription_id) {
      // No subscription found
      return res.json({
        hasSubscription: false,
        subscription: null,
      })
    }

    try {
      // Retrieve subscription from Stripe
      const subscription = await stripe.subscriptions.retrieve(userUsage.stripe_subscription_id)

      res.json({
        hasSubscription: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: subscription.canceled_at,
        },
      })
    } catch (stripeError) {
      console.error('Error retrieving subscription from Stripe:', stripeError)
      // Subscription might have been deleted
      return res.json({
        hasSubscription: false,
        subscription: null,
      })
    }
  } catch (error) {
    console.error('Error fetching subscription details:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    res.status(500).json({
      error: 'Failed to fetch subscription details',
      message: errorMessage,
    })
  }
})

// Cancel subscription endpoint
router.post('/cancel-subscription', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    console.log(`Canceling subscription for user ${req.userId}`)

    // Get user_usage record to find subscription ID
    const { data: userUsage, error: fetchError } = await supabase
      .from('user_usage')
      .select('stripe_subscription_id')
      .eq('user_id', req.userId)
      .single()

    if (fetchError || !userUsage) {
      console.error('Error fetching user usage:', fetchError)
      return res.status(404).json({ error: 'User usage record not found' })
    }

    if (!userUsage.stripe_subscription_id) {
      return res.status(400).json({ error: 'No active subscription found' })
    }

    // Cancel the subscription in Stripe (at period end so they keep access until then)
    try {
      const subscription = await stripe.subscriptions.update(userUsage.stripe_subscription_id, {
        cancel_at_period_end: true,
      })
      console.log(`Scheduled cancellation for subscription ${subscription.id} for user ${req.userId} (ends at period end: ${subscription.current_period_end})`)

      // Note: We don't update the database here because the subscription is still active
      // The webhook will handle the downgrade when the subscription actually ends

      res.json({
        success: true,
        message: 'Subscription will be canceled at the end of the billing period',
        subscriptionId: subscription.id,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      })
    } catch (stripeError) {
      console.error('Error canceling subscription in Stripe:', stripeError)
      const errorMessage = stripeError instanceof Error ? stripeError.message : String(stripeError)
      return res.status(500).json({
        error: 'Failed to cancel subscription',
        message: errorMessage,
      })
    }
  } catch (error) {
    console.error('Error canceling subscription:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    res.status(500).json({
      error: 'Failed to cancel subscription',
      message: errorMessage,
    })
  }
})

export default router

