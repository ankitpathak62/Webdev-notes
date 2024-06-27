declare type StoreType =
  'CERT_SYSTEM_STORE_CURRENT_SERVICE' |
  'CERT_SYSTEM_STORE_CURRENT_USER' |
  'CERT_SYSTEM_STORE_CURRENT_USER_GROUP_POLICY' |
  'CERT_SYSTEM_STORE_LOCAL_MACHINE' |
  'CERT_SYSTEM_STORE_LOCAL_MACHINE_ENTERPRISE' |
  'CERT_SYSTEM_STORE_LOCAL_MACHINE_GROUP_POLICY' |
  'CERT_SYSTEM_STORE_SERVICES' |
  'CERT_SYSTEM_STORE_USERS';

declare interface StoreOptions {
  store?: string;
  storeTypeList?: Array<StoreType | number>;
};

declare type LookupOptions = StoreOptions & {
  requirePrivKey?: boolean;
} & ({
  subject: string;
  thumbprint?: never;
} | {
  subject?: never;
  thumbprint: Uint8Array;
});

declare interface PfxResult {
  passphrase: string;
  pfx: Uint8Array;
};

declare function exportCertificateAndPrivateKey(input: LookupOptions): PfxResult;

declare namespace exportCertificateAndPrivateKey {
  function exportCertificateAndPrivateKey(input: LookupOptions): PfxResult;

  function exportSystemCertificates(input: StoreOptions): string[];
}

export = exportCertificateAndPrivateKey;