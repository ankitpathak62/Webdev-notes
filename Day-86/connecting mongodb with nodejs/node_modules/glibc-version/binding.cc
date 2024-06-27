#include <napi.h>
#ifndef _WIN32
#include <dlfcn.h>
#endif

using namespace Napi;

namespace {

Value GetGlibcVersion(const CallbackInfo& args) {
  Env env = args.Env();

  const char* libc_version = nullptr;
#ifndef _WIN32
  const char* (*gnu_get_libc_version)();
  *(reinterpret_cast<void**>(&gnu_get_libc_version)) = dlsym(RTLD_DEFAULT, "gnu_get_libc_version");
  if (gnu_get_libc_version != nullptr) {
    libc_version = (*gnu_get_libc_version)();
  }
#endif
  if (libc_version != nullptr) {
    return String::New(env, libc_version);
  }
  return env.Undefined();
}

}

static Object InitGlibcVersion(Env env, Object exports) {
  exports["getGlibcVersion"] = Function::New(env, GetGlibcVersion);
  return exports;
}

NODE_API_MODULE(glibc_version, InitGlibcVersion)
