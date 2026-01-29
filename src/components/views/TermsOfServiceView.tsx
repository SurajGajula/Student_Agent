import React from 'react'
import { View, Text, StyleSheet, ScrollView, Platform, Dimensions, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface TermsOfServiceViewProps {
  onNavigate?: (view: string) => void
}

function TermsOfServiceView({ onNavigate }: TermsOfServiceViewProps) {
  const insets = useSafeAreaInsets()
  const windowWidth = Dimensions.get('window').width
  const isMobile = windowWidth <= 768
  
  const mobilePaddingTop = Platform.OS === 'ios' 
    ? Math.max(insets.top + 12, 20) 
    : Math.max(54, 20)

  const handleBack = () => {
    if (onNavigate) {
      onNavigate('settings')
    } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.back()
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isMobile && {
            paddingTop: mobilePaddingTop,
            paddingLeft: 16,
            paddingRight: 20,
          }
        ]}
      >
        <View style={styles.content}>
          {isMobile && (
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
          )}
          
          <Text style={[
            styles.title,
            isMobile && styles.titleMobile
          ]}>Terms of Service</Text>
          
          <Text style={styles.lastUpdated}>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Agreement to Terms</Text>
            <Text style={styles.paragraph}>
              By accessing or using Student Agent ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these Terms, you may not access or use the Service.
            </Text>
            <Text style={styles.paragraph}>
              These Terms constitute a legally binding agreement between you ("User," "you," or "your") and Student Agent ("Company," "we," "us," or "our"). Your use of the Service is subject to these Terms and our Privacy Policy, which is incorporated by reference into these Terms.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Description of Service</Text>
            <Text style={styles.paragraph}>
              Student Agent is an educational technology platform that provides tools for students to organize notes, create flashcards, generate practice tests, track goals, and interact with an AI-powered study assistant. The Service is available through our mobile application and web platform.
            </Text>
            <Text style={styles.paragraph}>
              We reserve the right to modify, suspend, or discontinue any part of the Service at any time, with or without notice. We shall not be liable to you or any third party for any modification, suspension, or discontinuance of the Service.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. User Accounts</Text>
            
            <Text style={styles.subsectionTitle}>3.1 Account Creation</Text>
            <Text style={styles.paragraph}>
              To use certain features of the Service, you must create an account by providing your email address, name, and a password. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.
            </Text>

            <Text style={styles.subsectionTitle}>3.2 Account Security</Text>
            <Text style={styles.paragraph}>
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account or any other breach of security.
            </Text>

            <Text style={styles.subsectionTitle}>3.3 Account Termination</Text>
            <Text style={styles.paragraph}>
              We reserve the right to suspend or terminate your account at any time, with or without notice, for any reason, including if you breach these Terms or engage in any fraudulent, abusive, or illegal activity.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Acceptable Use</Text>
            
            <Text style={styles.subsectionTitle}>4.1 Permitted Use</Text>
            <Text style={styles.paragraph}>
              You may use the Service only for lawful purposes and in accordance with these Terms. You agree not to:
            </Text>
            <Text style={styles.listItem}>• Violate any applicable local, state, national, or international law or regulation</Text>
            <Text style={styles.listItem}>• Transmit any malicious code, viruses, or harmful data</Text>
            <Text style={styles.listItem}>• Attempt to gain unauthorized access to the Service or its related systems</Text>
            <Text style={styles.listItem}>• Interfere with or disrupt the integrity or performance of the Service</Text>
            <Text style={styles.listItem}>• Use the Service to harass, abuse, or harm others</Text>
            <Text style={styles.listItem}>• Impersonate any person or entity or misrepresent your affiliation with any person or entity</Text>
            <Text style={styles.listItem}>• Use automated systems or scripts to access the Service without permission</Text>
            <Text style={styles.listItem}>• Copy, modify, or create derivative works of the Service</Text>
            <Text style={styles.listItem}>• Reverse engineer, decompile, or disassemble the Service</Text>

            <Text style={styles.subsectionTitle}>4.2 Content Standards</Text>
            <Text style={styles.paragraph}>
              You are solely responsible for all content you create, upload, or transmit through the Service ("User Content"). You represent and warrant that your User Content:
            </Text>
            <Text style={styles.listItem}>• Does not violate any third-party rights, including intellectual property, privacy, or publicity rights</Text>
            <Text style={styles.listItem}>• Is not defamatory, libelous, obscene, pornographic, or offensive</Text>
            <Text style={styles.listItem}>• Does not contain illegal or harmful content</Text>
            <Text style={styles.listItem}>• Does not infringe on any patent, trademark, trade secret, copyright, or other proprietary right</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Intellectual Property Rights</Text>
            
            <Text style={styles.subsectionTitle}>5.1 Service Ownership</Text>
            <Text style={styles.paragraph}>
              The Service, including its original content, features, and functionality, is owned by Student Agent and is protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </Text>

            <Text style={styles.subsectionTitle}>5.2 Your Content</Text>
            <Text style={styles.paragraph}>
              You retain ownership of any User Content you create or upload to the Service. By using the Service, you grant us a worldwide, non-exclusive, royalty-free license to use, store, reproduce, modify, and distribute your User Content solely for the purpose of providing and improving the Service.
            </Text>

            <Text style={styles.subsectionTitle}>5.3 AI-Generated Content</Text>
            <Text style={styles.paragraph}>
              Content generated by our AI features (such as test questions, flashcards, or chat responses) is provided for your personal, non-commercial use. You may not reproduce, distribute, or commercialize AI-generated content without our express written permission.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Subscriptions and Payments</Text>
            
            <Text style={styles.subsectionTitle}>6.1 Subscription Plans</Text>
            <Text style={styles.paragraph}>
              The Service offers both free and premium subscription plans. Premium plans provide access to additional features and higher usage limits. We reserve the right to modify subscription plans, features, and pricing at any time.
            </Text>

            <Text style={styles.subsectionTitle}>6.2 Payment Terms</Text>
            <Text style={styles.paragraph}>
              Subscription fees are billed in advance on a recurring basis (monthly or annually). Payments are processed by third-party payment processors (Stripe). By subscribing, you agree to pay all charges associated with your subscription.
            </Text>

            <Text style={styles.subsectionTitle}>6.3 Automatic Renewal</Text>
            <Text style={styles.paragraph}>
              Unless you cancel your subscription before the end of the billing period, your subscription will automatically renew. You may cancel your subscription at any time through your account settings or by contacting support.
            </Text>

            <Text style={styles.subsectionTitle}>6.4 Refunds</Text>
            <Text style={styles.paragraph}>
              Subscription fees are non-refundable, except as required by law or at our sole discretion. Refund requests must be submitted within 30 days of the charge date.
            </Text>

            <Text style={styles.subsectionTitle}>6.5 Price Changes</Text>
            <Text style={styles.paragraph}>
              We reserve the right to change subscription prices. Price changes will be communicated to you in advance and will apply to your next billing cycle unless you cancel your subscription.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Third-Party Services</Text>
            <Text style={styles.paragraph}>
              The Service integrates with third-party services, including:
            </Text>
            <Text style={styles.listItem}>• <Text style={styles.bold}>Supabase:</Text> For database and authentication services</Text>
            <Text style={styles.listItem}>• <Text style={styles.bold}>Stripe:</Text> For payment processing</Text>
            <Text style={styles.listItem}>• <Text style={styles.bold}>Google Gemini AI:</Text> For AI-powered features</Text>
            <Text style={styles.paragraph}>
              Your use of these third-party services is subject to their respective terms of service and privacy policies. We are not responsible for the practices of third-party services.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. Disclaimers and Limitations of Liability</Text>
            
            <Text style={styles.subsectionTitle}>8.1 Service Disclaimer</Text>
            <Text style={styles.paragraph}>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </Text>

            <Text style={styles.subsectionTitle}>8.2 AI Content Disclaimer</Text>
            <Text style={styles.paragraph}>
              AI-generated content (including test questions, flashcards, and chat responses) is provided for informational purposes only. While we strive for accuracy, AI-generated content may contain errors or inaccuracies. You are responsible for verifying the accuracy of any AI-generated content before relying on it for academic or other purposes.
            </Text>

            <Text style={styles.subsectionTitle}>8.3 Limitation of Liability</Text>
            <Text style={styles.paragraph}>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF THE SERVICE.
            </Text>
            <Text style={styles.paragraph}>
              OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE USE OF THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM, OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS GREATER.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>9. Indemnification</Text>
            <Text style={styles.paragraph}>
              You agree to indemnify, defend, and hold harmless Student Agent, its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorney's fees, arising out of or in any way connected with:
            </Text>
            <Text style={styles.listItem}>• Your access to or use of the Service</Text>
            <Text style={styles.listItem}>• Your User Content</Text>
            <Text style={styles.listItem}>• Your violation of these Terms</Text>
            <Text style={styles.listItem}>• Your violation of any third-party rights</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>10. Termination</Text>
            
            <Text style={styles.subsectionTitle}>10.1 Termination by You</Text>
            <Text style={styles.paragraph}>
              You may terminate your account at any time by deleting your account through the app settings or by contacting support. Upon termination, your right to use the Service will immediately cease.
            </Text>

            <Text style={styles.subsectionTitle}>10.2 Termination by Us</Text>
            <Text style={styles.paragraph}>
              We may terminate or suspend your account immediately, without prior notice, if you breach these Terms or engage in any conduct that we determine is harmful to the Service or other users.
            </Text>

            <Text style={styles.subsectionTitle}>10.3 Effect of Termination</Text>
            <Text style={styles.paragraph}>
              Upon termination, your account and all associated data may be deleted. We are not obligated to retain or provide you with any data after termination. Sections of these Terms that by their nature should survive termination will survive, including Sections 5 (Intellectual Property), 8 (Disclaimers), 9 (Indemnification), and 12 (Governing Law).
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>11. Changes to Terms</Text>
            <Text style={styles.paragraph}>
              We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms in the app and updating the "Last updated" date. Your continued use of the Service after any changes constitutes acceptance of the modified Terms.
            </Text>
            <Text style={styles.paragraph}>
              If you do not agree to the modified Terms, you must stop using the Service and may terminate your account.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>12. Governing Law and Dispute Resolution</Text>
            
            <Text style={styles.subsectionTitle}>12.1 Governing Law</Text>
            <Text style={styles.paragraph}>
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Student Agent operates, without regard to its conflict of law provisions.
            </Text>

            <Text style={styles.subsectionTitle}>12.2 Dispute Resolution</Text>
            <Text style={styles.paragraph}>
              Any disputes arising out of or relating to these Terms or the Service shall be resolved through binding arbitration in accordance with the rules of a recognized arbitration organization, except where prohibited by law. You waive any right to participate in a class-action lawsuit or class-wide arbitration.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>13. Miscellaneous</Text>
            
            <Text style={styles.subsectionTitle}>13.1 Entire Agreement</Text>
            <Text style={styles.paragraph}>
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and Student Agent regarding the Service and supersede all prior agreements and understandings.
            </Text>

            <Text style={styles.subsectionTitle}>13.2 Severability</Text>
            <Text style={styles.paragraph}>
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
            </Text>

            <Text style={styles.subsectionTitle}>13.3 Waiver</Text>
            <Text style={styles.paragraph}>
              Our failure to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision.
            </Text>

            <Text style={styles.subsectionTitle}>13.4 Assignment</Text>
            <Text style={styles.paragraph}>
              You may not assign or transfer these Terms or your account without our prior written consent. We may assign these Terms without restriction.
            </Text>

            <Text style={styles.subsectionTitle}>13.5 Contact Information</Text>
            <Text style={styles.paragraph}>
              If you have any questions about these Terms, please contact us:
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>Email:</Text> surajgajula@thesfstudio.com{'\n'}
              <Text style={styles.bold}>Website:</Text> https://studentagent.site
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>14. Acknowledgment</Text>
            <Text style={styles.paragraph}>
              By using Student Agent, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  content: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  backButton: {
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    color: '#0f0f0f',
    fontWeight: '400',
  },
  title: {
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: -0.5,
    color: '#0f0f0f',
    marginBottom: 8,
  },
  titleMobile: {
    paddingLeft: 0,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#666',
    fontWeight: '300',
    marginBottom: 32,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '400',
    letterSpacing: -0.3,
    color: '#0f0f0f',
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 18,
    fontWeight: '400',
    color: '#0f0f0f',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: '#333',
    fontWeight: '300',
    marginBottom: 12,
  },
  listItem: {
    fontSize: 15,
    lineHeight: 24,
    color: '#333',
    fontWeight: '300',
    marginBottom: 8,
    marginLeft: 16,
  },
  bold: {
    fontWeight: '600',
    color: '#0f0f0f',
  },
})

export default TermsOfServiceView

