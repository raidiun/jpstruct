# jpstruct (Js-Python Struct)

JavaScript port of Python struct. No dependencies. Requires `BigInt` from ES2020.

## Caveats

In Python, the empty array `[]` is truthy, while in JavaScript it is falsy. This has an impact on
how booleans are encoded.

Values that return true from `Number.isInteger()` will be coerced into integers for integer format
characters. This breaks with Python behaviour where this raises an error.

The native size format characters `n` and `N` are interpreted the same as `i` and `I`. That is
the platform is assumed to use 32-bit `ssize_t` and `size_t` types. Similarly, the pointer format
character `P` is also assumed to be 32-bit and is interpreted the same as `I`.

The half-precision floating point format character `e` is not supported. It will be treated as
an unsigned short.

The perl-string format character `p` is not supported.
