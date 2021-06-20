# jpstruct (Js-Python Struct)

Vanilla JavaScript port of [Python's `struct`](https://docs.python.org/3/library/struct.html).
Implemented as an ESM module for simple usage into the browser.

Requires support for [`BigInt`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt#browser_compatibility)
and [`BigUint64Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigUint64Array#browser_compatibility)
from ES2020 for `Q` and `q` format characters.

## Input and Output

`Uint8Array`s are used for byte-level representations.

Unpacking operations return an `Array` containing the the unpacked data in the same order as the
format string.

## Differences from Python's `struct`

In Python, the empty array `[]` is truthy, while in JavaScript it is falsy. This means that
`struct.pack('?',[])` in Python has a different result to `jpstruct.pack('?',[]);` in JavaScript.

Values that return `true` from `Number.isInteger()` will be coerced into integers for integer format
characters. This breaks with Python behaviour where attempting to pack a float would raise an error.

The native size format characters `n` and `N` are interpreted the as `i` and `I`, _i.e._ the
platform is assumed to use 32-bit `ssize_t` and `size_t` types. Similarly, the pointer format
character `P` is also assumed to be 32-bit and is interpreted as `I`.

The half-precision floating point format character `e` is not supported. It will be treated as
an unsigned short (`H` format character).

The perl-string format character `p` is not supported.

## Format String

The format string format is the same as Python's implementation with a few caveats detailed below.

### Byteorder Marker

The leading character of a format string can be used to indicate the byte order of the underlying
data. In Python's implementation, this can also determine additional size and alignment variations.
In this implementation, no alignment padding is added to any of the variants. Additionally,
standard sizes apply for all cases.

Character | Endianness
----------|---------------------------------
`@`       | (Platform determined)
`=`       | (Platform determined)
`<`       | Little-endian
`>`       | Big-endian
`!`       | Big-endian (network byte order)

As in Python, if the leading character is not one of the options in the table, the functions will
behave as if the leading character was `@`.

### Format Characters

The remainder of the format string is made up of format characters and an optional count preceding
each format character. The count is a base-10 integer that effectively repeats the following format
character. For strings (`s`), the count is used to specify the length of the string.

Format Character | C Type                     | Javascript Type
-----------------|----------------------------|------------------------------------
`x`              | -                          | Used to add padding byte to format
`c`              | `char`                     | `string` (length 1)
`b`              | `int8_t`                   | `number`
`B`              | `uint8_t`                  | `number`
`?`              | `bool` (encoded as 1 byte) | `boolean`
`h`              | `int16_t`                  | `number`
`H`              | `uint16_t`                 | `number`
`i`              | `int32_t`                  | `number`
`I`              | `uint32_t`                 | `number`
`l`              | `int32_t`                  | `number`
`L`              | `uint32_t`                 | `number`
`q`              | `int64_t`                  | `bigint`
`Q`              | `uint64_t`                 | `bigint`
`n`              | `int32_t`                  | `number`
`N`              | `uint32_t`                 | `number`
`e`              | `binary16`                 | `number`
`f`              | `float`                    | `number`
`d`              | `double`                   | `number`
`s`              | `char[]`                   | `Uint8Array`
`P`              | `void*`                    | `number`

To convert the `Uint8Array` returned from a `s` format string:

```js
let unpacked = jpstruct.unpack('4s',Uint8Array.from([0x20,0x20,0x20,0x20]));
let result = String.fromCharCode(...unpacked[0]);
```

## Examples

### Pack a string
```js
import * as jpstruct from '../jpstruct.js';

let packed = jpstruct.pack('10s','helloworld');
```

### Pack into a supplied buffer
```js
const orderedfields =  [253,13,0,0,40,11,10,33280,0];
const formatter = new jpstruct.Struct('<BBBBBBBHB');

let writable_buf = new Uint8Array(100);

formatter.pack_into(writable_buf,0,...orderedfields);
```

### Pack a `BigInt`
```js
const packed = jpstruct.pack('<Q',72340172838076673n);
```


## Tests

The testsuite attempts to replicate all of the tests present in the
[Python testsuite](https://github.com/python/cpython/blob/main/Lib/test/test_struct.py). There are
still a few missing at this point but coverage is 100% when big-endian platform detection is 
excluded.

There are also some additional tests that are a hangover from MAVLink porting efforts.

```sh
npm test
```