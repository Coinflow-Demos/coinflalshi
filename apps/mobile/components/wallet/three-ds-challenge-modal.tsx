import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import {API_BASE_URL} from '@/lib/api';
import {colors} from '@/constants/theme';

/** React Native has no DOM for @basis-theory/web-threeds, so this opens the
 * web app's /embed/3ds-challenge page in a WebView and waits for it to
 * postMessage completion. */
export function ThreeDsChallengeModal({
  url,
  creq,
  transactionId,
  onComplete,
  onClose,
}: {
  url: string;
  creq: string;
  transactionId: string;
  onComplete: (transactionId: string) => void;
  onClose: () => void;
}) {
  const embedUrl = `${API_BASE_URL}/embed/3ds-challenge?${new URLSearchParams({
    url,
    creq,
    transactionId,
  }).toString()}`;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Verify your card</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
        <WebView
          source={{uri: embedUrl}}
          style={{flex: 1}}
          onMessage={(event) => {
            try {
              const parsed = JSON.parse(event.nativeEvent.data);
              if (parsed.method === 'complete' && parsed.transactionId) {
                onComplete(parsed.transactionId);
              }
            } catch {
              // not JSON — ignore
            }
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  headerText: {fontSize: 15, fontWeight: '600', color: '#111827'},
  closeText: {color: colors.primary, fontWeight: '600'},
});
