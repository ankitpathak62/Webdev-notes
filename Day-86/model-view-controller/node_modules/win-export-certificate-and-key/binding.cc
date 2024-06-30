#include <napi.h>
#include <windows.h>
#include <wincrypt.h>

using namespace Napi;

namespace {

// Naive RAII cleanup helper.
struct Cleanup {
  std::function<void()> fn;
  Cleanup(std::function<void()> fn) : fn(fn) {}
  ~Cleanup() { fn(); }
};

// Convert UTF-8 to a Windows UTF-16 wstring.
std::wstring MultiByteToWideChar(Value value) {
  static_assert(sizeof(std::wstring::value_type) == sizeof(std::u16string::value_type),
      "wstring and u16string have the same value type on Windows");
  std::u16string u16 = value.ToString();
  return std::wstring(u16.begin(), u16.end());
}

// Throw an exception based on the last Windows error message.
void ThrowWindowsError(Env env, const char* call) {
  DWORD err = GetLastError();
  CHAR err_msg_buf[128];

  FormatMessageA(
      FORMAT_MESSAGE_FROM_SYSTEM |
      FORMAT_MESSAGE_IGNORE_INSERTS,
      nullptr,
      err,
      0,
      err_msg_buf,
      sizeof(err_msg_buf),
      nullptr);
  err_msg_buf[sizeof(err_msg_buf) - 1] = '\0';
  size_t err_msg_len = strlen(err_msg_buf);
  if (err_msg_len > 0 && err_msg_buf[err_msg_len - 1] == '\n') {
    err_msg_buf[strlen(err_msg_buf) - 1] = '\0';
    if (err_msg_len > 1 && err_msg_buf[err_msg_len - 2] == '\r') {
      err_msg_buf[err_msg_len - 2] = '\0';
    }
  }

  char buf[256];
  snprintf(buf,
           sizeof(buf),
           "%s failed with: %s (0x%lx)",
           call,
           err_msg_buf,
           static_cast<unsigned long>(err));
  throw Error::New(env, buf);
}

// Create a temporary certificate store, add 'cert' to it, and then
// export it (using 'password' for encryption).
Buffer<BYTE> CertToBuffer(Env env, PCCERT_CONTEXT cert, LPCWSTR password, DWORD export_flags) {
  HCERTSTORE memstore = CertOpenStore(CERT_STORE_PROV_MEMORY, 0, 0, 0, 0);
  if (!memstore) {
    ThrowWindowsError(env, "CertOpenStore(CERT_STORE_PROV_MEMORY)");
  }
  Cleanup cleanup([&]() { CertCloseStore(memstore, 0); });
  if (!CertAddCertificateContextToStore(memstore, cert, CERT_STORE_ADD_ALWAYS, nullptr)) {
    ThrowWindowsError(env, "CertAddCertificateContextToStore()");
  }

  CRYPT_DATA_BLOB out = { 0, nullptr };
  if (!PFXExportCertStoreEx(memstore, &out, password, nullptr, export_flags)) {
    ThrowWindowsError(env, "PFXExportCertStoreEx()");
  }
  Buffer<BYTE> outbuf = Buffer<BYTE>::New(env, out.cbData);
  out.pbData = outbuf.Data();
  if (!PFXExportCertStoreEx(memstore, &out, password, nullptr, export_flags)) {
    ThrowWindowsError(env, "PFXExportCertStoreEx()");
  }

  return outbuf;
}

class CertStoreHandle {
 public:
  CertStoreHandle(HCERTSTORE store) : store_(store) {}
  ~CertStoreHandle() {
    CertCloseStore(store_, 0);
    if (current_cert_) {
      CertFreeCertificateContext(current_cert_);
    }
  }
  HCERTSTORE get() const { return store_; }
  operator boolean() const { return !!get(); }

  CertStoreHandle(CertStoreHandle&& other)
    : store_(other.store_), current_cert_(other.current_cert_) {
    other.store_ = nullptr;
    other.current_cert_ = nullptr;
  }
  CertStoreHandle& operator=(CertStoreHandle&& other) {
    this->~CertStoreHandle();
    return *new(this)CertStoreHandle(std::move(other));
  }

  PCCERT_CONTEXT next() {
    current_cert_ = CertEnumCertificatesInStore(store_, current_cert_);
    return current_cert_;
  }

 private:
  CertStoreHandle(const CertStoreHandle&) = delete;
  CertStoreHandle& operator=(const CertStoreHandle&) = delete;

  HCERTSTORE store_;
  PCCERT_CONTEXT current_cert_ = nullptr;
};

CertStoreHandle CertOpenStore(Env env, const std::wstring& name, DWORD type) {
  CertStoreHandle sys_cs = ::CertOpenStore(
    CERT_STORE_PROV_SYSTEM,
    0,
    NULL,
    type | CERT_STORE_READONLY_FLAG | CERT_STORE_DEFER_CLOSE_UNTIL_LAST_FREE_FLAG,
    name.data());
  if (!sys_cs) {
    ThrowWindowsError(env, "CertOpenStore()");
  }
  return sys_cs;
}

Value ExportAllCertificates(const CallbackInfo& args) {
  std::wstring sys_store_name = MultiByteToWideChar(args[0].ToString());
  DWORD store_type = args[1].ToNumber().Uint32Value();
  CertStoreHandle sys_cs = CertOpenStore(args.Env(), sys_store_name, store_type);

  PCCERT_CONTEXT cert;
  Array result = Array::New(args.Env());
  size_t index = 0;
  while (cert = sys_cs.next()) {
    Buffer<BYTE> buf = CertToBuffer(args.Env(), cert, L"", 0);
    result[index++] = buf;
  }
  return result;
}

// Export a given certificate from a system certificate store,
// identified either by its thumbprint or its subject line.
Value ExportCertificateAndKey(const CallbackInfo& args) {
  std::wstring password_buf = MultiByteToWideChar(args[0].ToString());
  LPCWSTR password = password_buf.data();
  std::wstring sys_store_name = MultiByteToWideChar(args[1].ToString());
  DWORD store_type = args[2].ToNumber().Uint32Value();
  CertStoreHandle sys_cs = CertOpenStore(args.Env(), sys_store_name, store_type);

  PCCERT_CONTEXT cert = nullptr;
  Object search_spec = args[3].ToObject();
  if (search_spec.HasOwnProperty("thumbprint")) {
    Buffer<BYTE> thumbprint = search_spec.Get("thumbprint").As<Buffer<BYTE>>();
    CRYPT_HASH_BLOB thumbprint_blob = {
      static_cast<DWORD>(thumbprint.Length()),
      thumbprint.Data()
    };
    cert = CertFindCertificateInStore(
        sys_cs.get(),
        X509_ASN_ENCODING | PKCS_7_ASN_ENCODING,
        0,
        CERT_FIND_HASH,
        &thumbprint_blob,
        nullptr);
  } else if (search_spec.HasOwnProperty("subject")) {
    cert = CertFindCertificateInStore(
        sys_cs.get(),
        X509_ASN_ENCODING | PKCS_7_ASN_ENCODING,
        0,
        CERT_FIND_SUBJECT_STR,
        MultiByteToWideChar(search_spec.Get("subject").ToString()).data(),
        nullptr);
  } else {
    SetLastError(CRYPT_E_NOT_FOUND);
  }
  if (!cert) {
    ThrowWindowsError(args.Env(), "CertFindCertificateInStore()");
  }

  Cleanup cleanup_cert([&]() { CertFreeCertificateContext(cert); });

  DWORD export_flags = EXPORT_PRIVATE_KEYS;
  if (args[4].ToBoolean()) {
    export_flags |= REPORT_NO_PRIVATE_KEY | REPORT_NOT_ABLE_TO_EXPORT_PRIVATE_KEY;
  }
  return CertToBuffer(args.Env(), cert, password, export_flags);
}

}

static Object InitWinExportCertAndKey(Env env, Object exports) {
  exports["exportCertificateAndKey"] = Function::New(env, ExportCertificateAndKey);
  exports["exportAllCertificates"] = Function::New(env, ExportAllCertificates);
  Object storeTypes = Object::New(env);
  storeTypes["CERT_SYSTEM_STORE_CURRENT_SERVICE"] = Number::New(env, CERT_SYSTEM_STORE_CURRENT_SERVICE);
  storeTypes["CERT_SYSTEM_STORE_CURRENT_USER"] = Number::New(env, CERT_SYSTEM_STORE_CURRENT_USER);
  storeTypes["CERT_SYSTEM_STORE_CURRENT_USER_GROUP_POLICY"] = Number::New(env, CERT_SYSTEM_STORE_CURRENT_USER_GROUP_POLICY);
  storeTypes["CERT_SYSTEM_STORE_LOCAL_MACHINE"] = Number::New(env, CERT_SYSTEM_STORE_LOCAL_MACHINE);
  storeTypes["CERT_SYSTEM_STORE_LOCAL_MACHINE_ENTERPRISE"] = Number::New(env, CERT_SYSTEM_STORE_LOCAL_MACHINE_ENTERPRISE);
  storeTypes["CERT_SYSTEM_STORE_LOCAL_MACHINE_GROUP_POLICY"] = Number::New(env, CERT_SYSTEM_STORE_LOCAL_MACHINE_GROUP_POLICY);
  storeTypes["CERT_SYSTEM_STORE_SERVICES"] = Number::New(env, CERT_SYSTEM_STORE_SERVICES);
  storeTypes["CERT_SYSTEM_STORE_USERS"] = Number::New(env, CERT_SYSTEM_STORE_USERS);
  exports["storeTypes"] = storeTypes;
  return exports;
}

NODE_API_MODULE(win_export_cert, InitWinExportCertAndKey)