# win-export-certificate-and-key

Access the Windows system certificate and key store.
This module is a native addon. It will only successfully work on Windows.
No prebuilt binaries are currently provided.

## API

### `exportCertificateAndPrivateKey(opts?)`

Export a certificate and its corresponding private key from the Windows CA store.

Valid options are:

- `subject`: Subject line of the certificate/key as a string.
- `thumbprint`: Thumbprint of the certificate/key as a Uint8Array.
  Either `subject` or `thumbprint` must be provided.
- `store`: Optional Windows certificate store name. Default: `MY`.
- `storeTypeList`: Optional array of Windows certificate store types
  to try. Default: `['CERT_SYSTEM_STORE_LOCAL_MACHINE', 'CERT_SYSTEM_STORE_CURRENT_USER']`.
- `requirePrivKey`: Boolean. If set, the
  `REPORT_NO_PRIVATE_KEY | REPORT_NOT_ABLE_TO_EXPORT_PRIVATE_KEY` flags will
  be passed to the wincrypt API.

This function returns a single certificate (and by default its private key)
combination as a .pfx file, along with a random passphrase that has been
used for encrypting the file.
It will throw an exception if no relevant certificate could be found.
The certificate in question can be specified either through its subject line
string or its thumbprint.

### `exportSystemCertificates(opts?)`

Export all system certificates (no private keys) matching the given
options.

Valid options are:

- `store`: Optional Windows certificate store name. Default: `ROOT`.
- `storeTypeList`: Optional array of Windows certificate store types
  to try. Default: `['CERT_SYSTEM_STORE_LOCAL_MACHINE', 'CERT_SYSTEM_STORE_CURRENT_USER']`.

This functions returns an array of PEM-formatted certificates.
(Note that this can be a fairly slow operation.)

## Testing

You need to import `testkeys\certificate.pfx` manually into your local
CA store in order for the tests to pass. Make sure to import that certificate
with the "exportable private key" option. The password for the file is `pass`.
