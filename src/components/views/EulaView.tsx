import React from 'react'
import { View, Text, StyleSheet, ScrollView, Platform, Dimensions, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface EulaViewProps {
  onNavigate?: (view: string) => void
}

/**
 * IMPORTANT:
 * Apple requires the EULA to include the Developer name/address/contact.
 * Replace the placeholder address/phone below with your real support contact details.
 */
const DEVELOPER_NAME = 'Suraj Gajula'
const DEVELOPER_ADDRESS = '10774 Flaxton St., CA'
const DEVELOPER_PHONE = '3109107495'
const DEVELOPER_EMAIL = 'surajgajula@thesfstudio.com'

function EulaView({ onNavigate }: EulaViewProps) {
  const insets = useSafeAreaInsets()
  const windowWidth = Dimensions.get('window').width
  const isMobile = windowWidth <= 768

  const mobilePaddingTop =
    Platform.OS === 'ios' ? Math.max(insets.top + 12, 20) : Math.max(54, 20)

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
          },
        ]}
      >
        <View style={styles.content}>
          {isMobile && (
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
          )}

          <Text style={[styles.title, isMobile && styles.titleMobile]}>
            End-User License Agreement (EULA)
          </Text>

          <Text style={styles.lastUpdated}>
            Effective date:{' '}
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Acknowledgement</Text>
            <Text style={styles.paragraph}>
              This End-User License Agreement (“EULA”) is concluded between you
              (“End-User”) and {DEVELOPER_NAME} (“Developer”), and not with
              Apple. Developer, not Apple, is solely responsible for the Licensed
              Application and the content thereof.
            </Text>
            <Text style={styles.paragraph}>
              This EULA may not provide for usage rules for the Licensed
              Application that are in conflict with the Apple Media Services
              Terms and Conditions as of the Effective Date (which you
              acknowledge you have had the opportunity to review).
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Scope of License</Text>
            <Text style={styles.paragraph}>
              Developer grants you a limited, non-transferable license to use
              the Licensed Application on any Apple-branded Products that you
              own or control and as permitted by the Usage Rules set forth in
              the Apple Media Services Terms and Conditions, except that such
              Licensed Application may be accessed and used by other accounts
              associated with you via Family Sharing or volume purchasing.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Maintenance and Support</Text>
            <Text style={styles.paragraph}>
              Developer is solely responsible for providing any maintenance and
              support services with respect to the Licensed Application, as
              specified in this EULA or as required under applicable law.
            </Text>
            <Text style={styles.paragraph}>
              Developer and you acknowledge that Apple has no obligation
              whatsoever to furnish any maintenance and support services with
              respect to the Licensed Application.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Warranty</Text>
            <Text style={styles.paragraph}>
              Developer is solely responsible for any product warranties,
              whether express or implied by law, to the extent not effectively
              disclaimed.
            </Text>
            <Text style={styles.paragraph}>
              In the event of any failure of the Licensed Application to
              conform to any applicable warranty, you may notify Apple, and
              Apple will refund the purchase price for the Licensed Application
              to you; and to the maximum extent permitted by applicable law,
              Apple will have no other warranty obligation whatsoever with
              respect to the Licensed Application, and any other claims,
              losses, liabilities, damages, costs or expenses attributable to
              any failure to conform to any warranty will be Developer’s sole
              responsibility.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Product Claims</Text>
            <Text style={styles.paragraph}>
              Developer, not Apple, is responsible for addressing any claims by
              you or any third party relating to the Licensed Application or
              your possession and/or use of the Licensed Application,
              including, but not limited to: (i) product liability claims; (ii)
              any claim that the Licensed Application fails to conform to any
              applicable legal or regulatory requirement; and (iii) claims
              arising under consumer protection, privacy, or similar
              legislation, including in connection with the Licensed
              Application’s use of the HealthKit and HomeKit frameworks.
            </Text>
            <Text style={styles.paragraph}>
              This EULA does not limit Developer’s liability to you beyond what
              is permitted by applicable law.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Intellectual Property Rights</Text>
            <Text style={styles.paragraph}>
              In the event of any third-party claim that the Licensed
              Application or your possession and use of the Licensed Application
              infringes that third party’s intellectual property rights,
              Developer, not Apple, will be solely responsible for the
              investigation, defense, settlement and discharge of any such
              intellectual property infringement claim.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Legal Compliance</Text>
            <Text style={styles.paragraph}>
              You represent and warrant that (i) you are not located in a
              country that is subject to a U.S. Government embargo, or that has
              been designated by the U.S. Government as a “terrorist
              supporting” country; and (ii) you are not listed on any U.S.
              Government list of prohibited or restricted parties.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. Developer Name and Address</Text>
            <Text style={styles.paragraph}>
              Questions, complaints or claims with respect to the Licensed
              Application should be directed to:
            </Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>Developer:</Text> {DEVELOPER_NAME}
              {'\n'}
              <Text style={styles.bold}>Address:</Text> {DEVELOPER_ADDRESS}
              {'\n'}
              <Text style={styles.bold}>Telephone:</Text> {DEVELOPER_PHONE}
              {'\n'}
              <Text style={styles.bold}>Email:</Text> {DEVELOPER_EMAIL}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>9. Third Party Terms of Agreement</Text>
            <Text style={styles.paragraph}>
              You must comply with applicable third party terms of agreement
              when using the Licensed Application. For example, you must not be
              in violation of your wireless data service agreement when using
              the Licensed Application.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>10. Third Party Beneficiary</Text>
            <Text style={styles.paragraph}>
              Developer and you acknowledge and agree that Apple, and Apple’s
              subsidiaries, are third party beneficiaries of this EULA, and
              that, upon your acceptance of the terms and conditions of this
              EULA, Apple will have the right (and will be deemed to have
              accepted the right) to enforce this EULA against you as a third
              party beneficiary thereof.
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
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: '#333',
    fontWeight: '300',
    marginBottom: 12,
  },
  bold: {
    fontWeight: '600',
    color: '#0f0f0f',
  },
})

export default EulaView

