'use client';

import {Input} from '@/components/ui/input';

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
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">First name</label>
          <Input value={billing.firstName} onChange={(e) => onChange('firstName', e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Last name</label>
          <Input value={billing.lastName} onChange={(e) => onChange('lastName', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Email</label>
        <Input type="email" value={billing.email} onChange={(e) => onChange('email', e.target.value)} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Address</label>
        <Input value={billing.address1} onChange={(e) => onChange('address1', e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">City</label>
          <Input value={billing.city} onChange={(e) => onChange('city', e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">State</label>
          <Input value={billing.state} onChange={(e) => onChange('state', e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Zip</label>
          <Input value={billing.zip} onChange={(e) => onChange('zip', e.target.value)} />
        </div>
      </div>
    </>
  );
}
