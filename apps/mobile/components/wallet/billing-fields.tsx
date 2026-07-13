import {StyleSheet, Text, TextInput, View} from 'react-native';
import {colors} from '@/constants/theme';

export interface Billing {
  email: string;
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export const EMPTY_BILLING: Billing = {
  email: '',
  firstName: '',
  lastName: '',
  address1: '',
  city: '',
  state: '',
  zip: '',
  country: 'US',
};

export function BillingFields({
  billing,
  onChange,
}: {
  billing: Billing;
  onChange: <K extends keyof Billing>(key: K, value: Billing[K]) => void;
}) {
  return (
    <View style={{gap: 12}}>
      <View style={{flexDirection: 'row', gap: 10}}>
        <View style={{flex: 1}}>
          <Text style={styles.label}>First name</Text>
          <TextInput
            style={styles.input}
            value={billing.firstName}
            onChangeText={(v) => onChange('firstName', v)}
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={{flex: 1}}>
          <Text style={styles.label}>Last name</Text>
          <TextInput
            style={styles.input}
            value={billing.lastName}
            onChangeText={(v) => onChange('lastName', v)}
            placeholderTextColor={colors.muted}
          />
        </View>
      </View>
      <View>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          value={billing.email}
          onChangeText={(v) => onChange('email', v)}
          placeholderTextColor={colors.muted}
        />
      </View>
      <View>
        <Text style={styles.label}>Address</Text>
        <TextInput
          style={styles.input}
          value={billing.address1}
          onChangeText={(v) => onChange('address1', v)}
          placeholderTextColor={colors.muted}
        />
      </View>
      <View style={{flexDirection: 'row', gap: 10}}>
        <View style={{flex: 1}}>
          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            value={billing.city}
            onChangeText={(v) => onChange('city', v)}
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={{flex: 1}}>
          <Text style={styles.label}>State</Text>
          <TextInput
            style={styles.input}
            value={billing.state}
            onChangeText={(v) => onChange('state', v)}
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={{flex: 1}}>
          <Text style={styles.label}>Zip</Text>
          <TextInput
            style={styles.input}
            value={billing.zip}
            onChangeText={(v) => onChange('zip', v)}
            placeholderTextColor={colors.muted}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {color: colors.muted, fontSize: 12, marginBottom: 4},
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    color: colors.foreground,
    fontSize: 15,
  },
});
