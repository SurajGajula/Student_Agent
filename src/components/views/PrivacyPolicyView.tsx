import React from 'react'
import { View, Text, StyleSheet, ScrollView, Platform, Dimensions, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface PrivacyPolicyViewProps {
  onNavigate?: (view: string) => void
}

function PrivacyPolicyView({ onNavigate }: PrivacyPolicyViewProps) {
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
          ]}>Privacy Policy</Text>
          
          <Text style={styles.lastUpdated}>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Introduction</Text>
            <Text style={styles.paragraph}>
              Welcome to Student Agent ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and web services (collectively, the "Service").
            </Text>
            <Text style={styles.paragraph}>
              Please read this Privacy Policy carefully. By using our Service, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our Service.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Information We Collect</Text>
            
            <Text style={styles.subsectionTitle}>2.1 Information You Provide</Text>
            <Text style={styles.paragraph}>
              We collect information that you provide directly to us when you:
            </Text>
            <Text style={styles.listItem}>• Create an account (email address, name, password)</Text>
            <Text style={styles.listItem}>• Create, edit, or organize notes, flashcards, tests, and career paths</Text>
            <Text style={styles.listItem}>• Interact with our AI chat assistant</Text>
            <Text style={styles.listItem}>• Subscribe to premium services (payment information is processed by Stripe, not stored by us)</Text>
            <Text style={styles.listItem}>• Contact us for support</Text>

            <Text style={styles.subsectionTitle}>2.2 Automatically Collected Information</Text>
            <Text style={styles.paragraph}>
              When you use our Service, we automatically collect certain information, including:
            </Text>
            <Text style={styles.listItem}>• Device information (device type, operating system, unique device identifiers)</Text>
            <Text style={styles.listItem}>• Usage data (features used, time spent, frequency of use)</Text>
            <Text style={styles.listItem}>• Performance data (app crashes, errors, loading times)</Text>
            <Text style={styles.listItem}>• Location data (if enabled, for location-based features - currently not used)</Text>

            <Text style={styles.subsectionTitle}>2.3 AI-Generated Content</Text>
            <Text style={styles.paragraph}>
              Our Service uses AI to generate tests, flashcards, and provide chat assistance. The content you input and AI-generated responses may be processed by third-party AI services (Google Gemini) to provide these features.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
            <Text style={styles.paragraph}>
              We use the information we collect to:
            </Text>
            <Text style={styles.listItem}>• Provide, maintain, and improve our Service</Text>
            <Text style={styles.listItem}>• Process your account registration and authenticate users</Text>
            <Text style={styles.listItem}>• Store and sync your notes, flashcards, tests, and career paths across devices</Text>
            <Text style={styles.listItem}>• Generate AI-powered content (tests, flashcards, chat responses)</Text>
            <Text style={styles.listItem}>• Process payments and manage subscriptions</Text>
            <Text style={styles.listItem}>• Send you technical notices, updates, and support messages</Text>
            <Text style={styles.listItem}>• Monitor and analyze usage patterns to improve user experience</Text>
            <Text style={styles.listItem}>• Detect, prevent, and address technical issues and security threats</Text>
            <Text style={styles.listItem}>• Comply with legal obligations and enforce our terms of service</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Information Sharing and Disclosure</Text>
            
            <Text style={styles.subsectionTitle}>4.1 Third-Party Service Providers</Text>
            <Text style={styles.paragraph}>
              We share your information with trusted third-party service providers who perform services on our behalf:
            </Text>
            <Text style={styles.listItem}>• <Text style={styles.bold}>Supabase:</Text> Database and authentication services. Your account information, notes, and user data are stored securely on Supabase's servers.</Text>
            <Text style={styles.listItem}>• <Text style={styles.bold}>Stripe:</Text> Payment processing for subscriptions. Stripe handles all payment information securely. We do not store your credit card details.</Text>
            <Text style={styles.listItem}>• <Text style={styles.bold}>Google Gemini AI:</Text> AI services for generating tests, flashcards, and chat responses. Content you submit for AI processing is sent to Google's servers.</Text>

            <Text style={styles.subsectionTitle}>4.2 Legal Requirements</Text>
            <Text style={styles.paragraph}>
              We may disclose your information if required by law, court order, or government regulation, or if we believe disclosure is necessary to protect our rights, property, or safety, or that of our users or others.
            </Text>

            <Text style={styles.subsectionTitle}>4.3 Business Transfers</Text>
            <Text style={styles.paragraph}>
              In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity, subject to the same privacy protections.
            </Text>

            <Text style={styles.subsectionTitle}>4.4 With Your Consent</Text>
            <Text style={styles.paragraph}>
              We may share your information with your explicit consent or at your direction.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Data Storage and Security</Text>
            <Text style={styles.paragraph}>
              We implement industry-standard security measures to protect your information:
            </Text>
            <Text style={styles.listItem}>• All data is encrypted in transit using HTTPS/TLS</Text>
            <Text style={styles.listItem}>• Data at rest is encrypted using database encryption</Text>
            <Text style={styles.listItem}>• Authentication is handled securely through Supabase Auth</Text>
            <Text style={styles.listItem}>• Access to your data is restricted to authorized personnel only</Text>
            <Text style={styles.paragraph}>
              However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Your Rights and Choices</Text>
            
            <Text style={styles.subsectionTitle}>6.1 Access and Update</Text>
            <Text style={styles.paragraph}>
              You can access and update your account information, notes, and other data directly through the app settings.
            </Text>

            <Text style={styles.subsectionTitle}>6.2 Data Deletion</Text>
            <Text style={styles.paragraph}>
              You can delete your account and all associated data at any time through the app settings. Deletion is permanent and cannot be undone.
            </Text>

            <Text style={styles.subsectionTitle}>6.3 Export Your Data</Text>
            <Text style={styles.paragraph}>
              You can export your notes, flashcards, and other content through the app's export features.
            </Text>

            <Text style={styles.subsectionTitle}>6.4 Opt-Out</Text>
            <Text style={styles.paragraph}>
              You can opt out of certain data collection by adjusting your device settings or app preferences. Note that some features may not function properly if you opt out of essential data collection.
            </Text>

            <Text style={styles.subsectionTitle}>6.5 California Privacy Rights (CCPA)</Text>
            <Text style={styles.paragraph}>
              If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, the right to delete personal information, and the right to opt-out of the sale of personal information (we do not sell personal information).
            </Text>

            <Text style={styles.subsectionTitle}>6.6 European Privacy Rights (GDPR)</Text>
            <Text style={styles.paragraph}>
              If you are located in the European Economic Area (EEA), you have additional rights under the General Data Protection Regulation (GDPR), including the right to access, rectify, erase, restrict processing, data portability, and object to processing of your personal information.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Children's Privacy</Text>
            <Text style={styles.paragraph}>
              Our Service is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately. If we discover that we have collected information from a child under 13, we will delete it promptly.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. International Data Transfers</Text>
            <Text style={styles.paragraph}>
              Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. By using our Service, you consent to the transfer of your information to these countries.
            </Text>
            <Text style={styles.paragraph}>
              We ensure appropriate safeguards are in place to protect your information in accordance with this Privacy Policy, including standard contractual clauses where applicable.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>9. Data Retention</Text>
            <Text style={styles.paragraph}>
              We retain your information for as long as your account is active or as needed to provide you with our Service. If you delete your account, we will delete or anonymize your personal information within 30 days, except where we are required to retain it for legal or legitimate business purposes.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>10. Changes to This Privacy Policy</Text>
            <Text style={styles.paragraph}>
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy in the app and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </Text>
            <Text style={styles.paragraph}>
              Your continued use of the Service after any changes to this Privacy Policy constitutes acceptance of those changes.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>11. Third-Party Links</Text>
            <Text style={styles.paragraph}>
              Our Service may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to read their privacy policies before providing any information to them.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>12. Contact Us</Text>
            <Text style={styles.paragraph}>
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>Email:</Text> surajgajula@thesfstudio.com{'\n'}
              <Text style={styles.bold}>Website:</Text> https://studentagent.site
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>13. Consent</Text>
            <Text style={styles.paragraph}>
              By using Student Agent, you consent to our Privacy Policy and agree to its terms.
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

export default PrivacyPolicyView

