// Bottom sheet on phones, centred dialog on tablets. Replaces the website's modal.
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, useLayout } from '../theme'
import { H2 } from './ui'

export default function Sheet({ visible, title, onClose, children }) {
  const { isTablet, gutter, height } = useLayout()
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType={isTablet ? 'fade' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.45)', justifyContent: isTablet ? 'center' : 'flex-end', padding: isTablet ? 24 : 0 }}>
          {/* Only a tap that starts on the dimmed area closes the sheet */}
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />
          <View style={{
            backgroundColor: colors.surface, maxHeight: height * 0.9, width: '100%', maxWidth: 600, alignSelf: 'center',
            borderTopLeftRadius: radius + 6, borderTopRightRadius: radius + 6,
            borderBottomLeftRadius: isTablet ? radius + 6 : 0, borderBottomRightRadius: isTablet ? radius + 6 : 0,
          }}>
            <ScrollView keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: gutter, paddingBottom: gutter + (isTablet ? 0 : insets.bottom), gap: 12 }}>
              <H2>{title}</H2>
              {children}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
