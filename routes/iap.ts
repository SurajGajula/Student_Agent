// Load environment variables first
import '../load-env.js'

import express, { Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { authenticateUser, AuthenticatedRequest } from './middleware/auth.js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const router = express.Router()

// Verify IAP receipt and activate subscription
router.post('/verify-receipt', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { receipt, productId, transactionId } = req.body

    if (!receipt || !productId) {
      return res.status(400).json({ error: 'Receipt and product ID are required' })
    }

    // Verify receipt with Apple's App Store
    // For production, use: https://buy.itunes.apple.com/verifyReceipt
    // For sandbox, use: https://sandbox.itunes.apple.com/verifyReceipt
    const isProduction = process.env.NODE_ENV === 'production'
    const verifyURL = isProduction
      ? 'https://buy.itunes.apple.com/verifyReceipt'
      : 'https://sandbox.itunes.apple.com/verifyReceipt'

    // Get the shared secret from environment (set in App Store Connect)
    const sharedSecret = process.env.APPLE_IAP_SHARED_SECRET

    const verifyResponse = await fetch(verifyURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'receipt-data': receipt,
        'password': sharedSecret, // Optional: shared secret for auto-renewable subscriptions
      }),
    })

    const verifyData = await verifyResponse.json()

    // Check if receipt is valid
    if (verifyData.status !== 0) {
      // Status 21007 means receipt is from sandbox but we're using production endpoint
      // Retry with sandbox
      if (verifyData.status === 21007 && isProduction) {
        const sandboxResponse = await fetch('https://sandbox.itunes.apple.com/verifyReceipt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            'receipt-data': receipt,
            'password': sharedSecret,
          }),
        })
        const sandboxData = await sandboxResponse.json()
        
        if (sandboxData.status !== 0) {
          return res.status(400).json({ 
            error: 'Invalid receipt', 
            status: sandboxData.status 
          })
        }
        
        // Process sandbox receipt
        return processReceipt(req.userId, sandboxData, productId, transactionId, res)
      }
      
      return res.status(400).json({ 
        error: 'Invalid receipt', 
        status: verifyData.status 
      })
    }

    // Process valid receipt
    return processReceipt(req.userId, verifyData, productId, transactionId, res)
  } catch (error) {
    console.error('Error verifying IAP receipt:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to verify receipt'
    res.status(500).json({ error: errorMessage })
  }
})

async function processReceipt(
  userId: string,
  receiptData: any,
  productId: string,
  transactionId: string | undefined,
  res: Response
) {
  try {
    // Extract subscription info from receipt
    const latestReceiptInfo = receiptData.latest_receipt_info?.[0] || receiptData.receipt?.in_app?.[0]
    
    if (!latestReceiptInfo) {
      return res.status(400).json({ error: 'No subscription information found in receipt' })
    }

    // Check if this is the correct product
    if (latestReceiptInfo.product_id !== productId) {
      return res.status(400).json({ error: 'Product ID mismatch' })
    }

    // Get expiration date
    const expiresDate = latestReceiptInfo.expires_date_ms
      ? new Date(parseInt(latestReceiptInfo.expires_date_ms))
      : null

    // Check if subscription is still active
    const isActive = expiresDate ? expiresDate > new Date() : true

    if (!isActive) {
      return res.status(400).json({ error: 'Subscription has expired' })
    }

    // Update user's plan in Supabase
    // First, get the Pro plan ID
    const { data: plans, error: plansError } = await supabase
      .from('plans')
      .select('id')
      .eq('name', 'pro')
      .single()

    if (plansError || !plans) {
      console.error('Error fetching Pro plan:', plansError)
      return res.status(500).json({ error: 'Failed to fetch plan information' })
    }

    // Update or create user_usage record
    const { error: usageError } = await supabase
      .from('user_usage')
      .upsert({
        user_id: userId,
        plan_id: plans.id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (usageError) {
      console.error('Error updating user plan:', usageError)
      return res.status(500).json({ error: 'Failed to activate subscription' })
    }

    // Store IAP transaction info (optional, for tracking)
    if (transactionId) {
      const { error } = await supabase
        .from('iap_transactions')
        .insert({
          user_id: userId,
          transaction_id: transactionId,
          product_id: productId,
          receipt_data: JSON.stringify(receiptData),
          expires_at: expiresDate?.toISOString() || null,
        })
      
      if (error) {
        // Log but don't fail if table doesn't exist
        console.warn('Could not store IAP transaction:', error)
      }
    }

    res.json({ 
      success: true, 
      message: 'Subscription activated successfully',
      expiresAt: expiresDate?.toISOString() || null,
    })
  } catch (error) {
    console.error('Error processing receipt:', error)
    res.status(500).json({ 
      error: 'Failed to process receipt',
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

// Restore IAP purchases
router.post('/restore-purchases', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // This endpoint is called from the app after restoring purchases via IAP
    // The app should call InAppPurchases.getPurchaseHistoryAsync() and then
    // verify each receipt with this endpoint

    res.json({ 
      success: true, 
      message: 'Use InAppPurchases.getPurchaseHistoryAsync() in the app, then verify receipts',
    })
  } catch (error) {
    console.error('Error restoring IAP purchases:', error)
    res.status(500).json({ error: 'Failed to restore purchases' })
  }
})

export default router
