//! The app's `libnsh.so`: the Android runtime with `nsh/base` and the
//! app's Rust components.

#[cfg(target_os = "android")]
nsh::ui_sets!(vec![nsh_base::registry()]);

// Without the entry: nsh's stand-in, which fails the build saying what to add.
#[cfg(target_os = "android")]
#[allow(unused_imports)]
use nsh_core::element::__private::no_native_module as __nsh_native_module;
