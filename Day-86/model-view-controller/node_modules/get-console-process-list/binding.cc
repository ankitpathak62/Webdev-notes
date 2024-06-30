#include <napi.h>
#include <windows.h>

namespace {
using namespace Napi;

// Throw an exception based on the last Windows error message.
static void ThrowWindowsError(Env env, const char* call) {
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

Value GetConsoleProcessListBinding(const CallbackInfo& args) {
  std::vector<DWORD> pids(128);
retry:
  DWORD result = GetConsoleProcessList(pids.data(), pids.size());
  if (result > pids.size()) {
    pids.resize(result);
    goto retry;
  }
  if (result <= 0) {
    ThrowWindowsError(args.Env(), "GetConsoleProcessList");
  }
  
  Array ret = Array::New(args.Env(), result);
  for (DWORD i = 0; i < result; i++)
    ret.Set(i, Number::New(args.Env(), pids[i]));
  return ret;
}

} // anonymous namespace

static Object InitGetConsoleProcessList(Env env, Object exports) {
  exports["getConsoleProcessList"] = Function::New(env, GetConsoleProcessListBinding);
  return exports;
}

NODE_API_MODULE(get_console_process_list, InitGetConsoleProcessList)