
import { describe, it, expect } from "vitest";
import * as jpstruct from "./jpstruct";

//const integer_codes = ['b', 'B', 'h', 'H', 'i', 'I', 'l', 'L', 'q', 'Q', 'n', 'N' ];
//const byteorders = ['', '@', '=', '<', '>', '!'];

// nN are exluded as they only exist for native byteorders
const integer_codes = ['b', 'B', 'h', 'H', 'i', 'I', 'l', 'L', 'q', 'Q', 'n', 'N' ];
const byteorders = ['', '@', '=', '<', '>', '!'];

function is_platform_bigendian() {
    // Stolen from: https://abdulapopoola.com/2019/01/20/check-endianness-with-javascript/
    const uint32Array = new Uint32Array([0x11223344]);
    const uint8Array = new Uint8Array(uint32Array.buffer);

    if(uint8Array[0] === 0x44) {
        return false;
    }
    else if( uint8Array[0] === 0x11 ) {
        return true;
    }

    throw new Error('Unknown endianness');
}

function iter_integer_formats(_byteorders=byteorders) {
    let result: [string, string][] = [];
    for( const code of integer_codes ) {
        for( const byteorder of _byteorders ) {
            if( !['','@'].includes(byteorder) && ['n','N'].includes(code) ) {
                continue;
            }
            result.push([code, byteorder]);
        }
    }
    return result;
}

// Convert hex chars to equivalent byteArray
function unhexlify(hexdata: string) {
    var byteArray = new Uint8Array(hexdata.length/2);
    for (var x = 0; x < byteArray.length; x++){
        byteArray[x] = parseInt(hexdata.substring(x*2,x*2+2), 16);
    }
    return byteArray
}

describe('Test native byteorder', function() {
    it('Uses correct native endianness', function() {
        let packed = jpstruct.pack('=i',1);
        expect(packed[0] === 0).toEqual(is_platform_bigendian());
    });
});

describe('Test consistency', function() {
    it('Throws on invalid format string',function() {
        expect(() => jpstruct.calcsize('Z')).toThrow();
    });

    it('Scales sizes',function() {
        const size = jpstruct.calcsize('i');
        expect(jpstruct.calcsize('iii')).toEqual(size * 3);

        const fmt = 'cbxxxxxxhhhhiillffd?';
        const fmt3 = '3c3b18x12h6i6l6f3d3?';
        const sz = jpstruct.calcsize(fmt);
        const sz3 = jpstruct.calcsize(fmt3);
        expect(sz3).toEqual(sz * 3);
    });

    it('Throws with incorrect number of arguments', function() {
        expect(() => {
            jpstruct.pack('iii', 3);
        }).toThrow(Error);

        expect(() => {
            jpstruct.pack('i', 3, 3, 3);
        }).toThrow(Error);
    });


    it('Throws with incorrect argument types', function() {
        expect(() => {
            jpstruct.pack('i', 'foo');
        }).toThrow(TypeError);

        expect(() => {
            jpstruct.pack('P', 'foo');
        }).toThrow(TypeError);
    });

    it('Throws with invalid data', function() {
        expect(() => {
            jpstruct.unpack('d', new TextEncoder().encode("flap"));
        }).toThrow(Error);

        const packed = jpstruct.pack('ii', 1, 2)

        expect(() => {
            jpstruct.unpack('iii', packed);
        }).toThrow(Error);

        expect(() => {
            jpstruct.unpack('i', packed);
        }).toThrow(Error);
        
    });

    // TODO: Check if this test is elsewhere in the suite
    it('Throws for non-native P',function() {
        expect(() => {
            jpstruct.pack('<P', 100);
        }).toThrow(Error);
        expect(() => {
            jpstruct.unpack('<P', new Uint8Array(8));
        }).toThrow(Error);
    });

});

describe('Test transitiveness', function() {
    const c = 'a';
    const b = 1;
    const h = 255;
    const i = 65535;
    const l = 65536;
    const f = 3.1415;
    const d = 3.1415;
    const t = true;

    for(const prefix of ['', '@', '<', '>', '=', '!']) {
        for(const base_format of ['xcbhilfd?', 'xcBHILfd?']) {
            const format = prefix + base_format;
            it(`Packs and unpacks for format: ${format}`, function() {
                let packed = jpstruct.pack(format, c, b, h, i, l, f, d, t);
                let [cp, bp, hp, ip, lp, fp, dp, tp] = jpstruct.unpack(format, packed);
                expect(cp).toEqual(c);
                expect(bp).toEqual(b);
                expect(hp).toEqual(h);
                expect(ip).toEqual(i);
                expect(lp).toEqual(l);
                expect(Math.round(100 * (fp as number))).toEqual(Math.round(100 * f));
                expect(Math.round(100 * (dp as number))).toEqual(Math.round(100 * d));
                expect(tp).toEqual(t);
            });
        }
    }
});

describe('Test "new" features', function() {
    function b(arr) {
        const numArr = arr.map(e => (typeof e === 'number' ? e : e.charCodeAt(0)) );
        return Uint8Array.from(numArr);
    }
    const test_definitions: [string, any, Uint8Array, Uint8Array, boolean][] = [
        ['c',  'a', b(['a']),   b(['a']),   false],
        ['xc', 'a', b([0,'a']), b([0,'a']), false],
        ['cx', 'a', b(['a',0]), b(['a',0]), false],
        ['s',  'a', b(['a']),   b(['a']),   false],
        ['0s',  'helloworld', b([]), b([]), true],
        ['1s',  'helloworld', b(['h']), b(['h']), true],
        ['9s',  'helloworld',
            b(['h','e','l','l','o','w','o','r','l']),
            b(['h','e','l','l','o','w','o','r','l']), true],
        ['10s', 'helloworld',
            b(['h','e','l','l','o','w','o','r','l','d']),
            b(['h','e','l','l','o','w','o','r','l','d']), false],
        ['11s', 'helloworld',
            b(['h','e','l','l','o','w','o','r','l','d',0]),
            b(['h','e','l','l','o','w','o','r','l','d',0]), true],
        ['20s', 'helloworld',
            b(['h','e','l','l','o','w','o','r','l','d',0,0,0,0,0,0,0,0,0,0]),
            b(['h','e','l','l','o','w','o','r','l','d',0,0,0,0,0,0,0,0,0,0]), true],
        ['b',    7,        b([7]),       b([7]),       false],
        ['b',   -7,        b([249]),     b([249]),     false],
        ['B',    7,        b([7]),       b([7]),       false],
        ['B',  249,        b([249]),     b([249]),     false],
        ['h',  700,        b([2,188]),   b([188,2]),   false],
        ['h', -700,        b([253,'D']), b(['D',253]), false],
        ['H',  700,        b([2,188]),   b([188,2]),   false],
        ['H', 0x10000-700, b([253,'D']), b(['D',253]), false],
        ['i', 70000000, b([4,',',29,128]), b([128,29,',',4]), false],
        ['i', -70000000, b([251,211,226,128]), b([128,226,211,251]), false],
        ['I', 70000000, b([4,',',29,128]), b([128,29,',',4]), false],
        ['I', 0x100000000-70000000, b([251,211,226,128]), b([128,226,211,251]), false],
        ['l', 70000000, b([4,',',29,128]), b([128,29,',',4]), false],
        ['l', -70000000, b([251,211,226,128]), b([128,226,211,251]), false],
        ['L', 70000000, b([4,',',29,128]), b([128,29,',',4]), false],
        ['L', 0x100000000-70000000, b([251,211,226,128]), b([128,226,211,251]), false],
        ['f', 2.0, b(['@',0,0,0]), b([0,0,0,'@']), false],
        ['d', 2.0, b(['@',0,0,0,0,0,0,0]), b([0,0,0,0,0,0,0,'@']), false],
        ['f', -2.0, b([192,0,0,0]), b([0,0,0,192]), false],
        ['d', -2.0, b([192,0,0,0,0,0,0,0]), b([0,0,0,0,0,0,0,192]), false],
        ['?', 0, b([0]), b([0]), true],
        ['?', 3, b([1]), b([1]), true],
        ['?', true, b([1]), b([1]), false],
        // Note: This next test differs from the Python equivalent due to different falsy values
        ['?', [], b([1]), b([1]), true],
        ['?', [1,], b([1]), b([1]), true]
    ];
    
    for(const [format, arguement, bigendian_result, littleendian_result, asymmetric] of test_definitions) {
        it(`Passes tests of format ${format} with arg "${arguement}"`, function () {
            const byteOrderTests: [string, Uint8Array][] = [
                ['>' + format, bigendian_result],
                ['!' + format, bigendian_result],
                ['<' + format, littleendian_result],
                ['=' + format, is_platform_bigendian() ? bigendian_result : littleendian_result]
            ];
            for( const [xfmt, exp] of byteOrderTests) {
                let packed = jpstruct.pack(xfmt, arguement);
                expect(packed).toStrictEqual(exp);
                expect(jpstruct.calcsize(xfmt)).toEqual(packed.length);
                let result = jpstruct.unpack(xfmt, packed)[0];
                if (result !== arguement) {
                    // Check if asymmetric operation
                    // If so we don't expect result to match
                    expect(asymmetric).toBe(true);
                }
            }
        });
        
    }
});

describe('Test calcsize', function() {
    let expected_size = {
        'b': 1, 'B': 1,
        'h': 2, 'H': 2,
        'i': 4, 'I': 4,
        'l': 4, 'L': 4,
        'q': 8, 'Q': 8,
        };

    // standard integer sizes
    it('Calculates correct size for standard integer formats', function() {
        for( let [code,byteorder] of iter_integer_formats(['=','<','>','!']) ) {
            const format = byteorder + code;
            let size = jpstruct.calcsize(format);
            expect(size).toEqual(expected_size[code]);
        }
    });
    

    const native_pairs = ['bB', 'hH', 'iI', 'lL', 'nN', 'qQ'];
    for( let format_pair of native_pairs ) {
        for( let byteorder of ['','@'] ) {
            it(`Calculates matching sizes for: ${format_pair}`, function() {
                let signed_size = jpstruct.calcsize(byteorder + format_pair[0]);
                let unsigned_size = jpstruct.calcsize(byteorder + format_pair[1]);
                expect(signed_size).toEqual(unsigned_size);
            });
        }
    }

    it('Has correct bounds for native integer sizes', function() {
        expect(jpstruct.calcsize('b')).toEqual(1);
        expect(jpstruct.calcsize('h')).toBeGreaterThanOrEqual(2);
        expect(jpstruct.calcsize('l')).toBeGreaterThanOrEqual(4);
        expect(jpstruct.calcsize('h')).toBeLessThanOrEqual(jpstruct.calcsize('i'));
        expect(jpstruct.calcsize('i')).toBeLessThanOrEqual(jpstruct.calcsize('l'));
        expect(jpstruct.calcsize('q')).toBeGreaterThanOrEqual(8);
        expect(jpstruct.calcsize('l')).toBeLessThanOrEqual(jpstruct.calcsize('q'));
        expect(jpstruct.calcsize('n')).toBeGreaterThanOrEqual(jpstruct.calcsize('i'));
        expect(jpstruct.calcsize('n')).toBeGreaterThanOrEqual(jpstruct.calcsize('P'));
    });

});

describe('Test integers', function() {
    class IntTester {
        byteorder: string;
        code: string;
        format: string;
        bytesize: number;
        bitsize: number;
        signed: boolean;
        min_value: bigint;
        max_value: bigint;

        constructor(byteorder: string, code: string) {
            this.byteorder = byteorder
            this.code = code;
            this.format = byteorder + code;
            this.bytesize = jpstruct.calcsize(this.format);
            this.bitsize = this.bytesize * 8;
            if( this.code == code.toUpperCase() ) {
                this.signed = false;
                this.min_value = BigInt(0);
                this.max_value = BigInt(2**this.bitsize - 1);
            }
            else {
                this.signed = true;
                this.min_value = BigInt(-(2**(this.bitsize-1)));
                this.max_value = BigInt(2**(this.bitsize-1) - 1);
            }
        }
        
        _test_one(x: number) {
            if( !(this.min_value <= BigInt(x) && BigInt(x) <= this.max_value) ) {
                // Out of range
                expect(() => {
                    jpstruct.pack(this.format,x)
                }).toThrow(RangeError);
                return;
            }

            // Generate the expected bytestream
            let expected = BigInt(x);
            if( this.signed && x < 0n ) {
                // Convert to unsigned equivalent
                expected += 1n << BigInt(this.bitsize);
            }
            expect(expected).toBeGreaterThanOrEqual(0n);

            // Get hex representation
            let hexRep = expected.toString(16);
            if( hexRep.length % 2 == 1 ) {
                hexRep = "0" + hexRep;
            }
            
            const bytes = unhexlify(hexRep);
            
            // Extend to appropriate length
            let byteStream = [...(new Uint8Array(this.bytesize-bytes.length)), ...bytes]

            if( this.byteorder === '<' || ['','@','='].includes(this.byteorder)) {
                byteStream = byteStream.reverse();
            }
            expect(byteStream.length).toEqual(this.bytesize);

            // Test pack
            let got = jpstruct.pack(this.format, x);
            expect([...got]).toStrictEqual(byteStream);

            // Test unpack
            let retrieved = jpstruct.unpack(this.format, got);
            if( this.code == 'Q' || this.code == 'q' ) {
                expect(retrieved[0]).toStrictEqual(BigInt(x));    
            }
            else{
                expect(retrieved[0]).toStrictEqual(x);
            }

            expect(() => {
                console.log(x, jpstruct.unpack(this.format, Uint8Array.from([1, ...got])));
            }).toThrow(Error);
        }

        run() {
            function range(n) {
                return [...Array(n).keys()]
            }

            function randomInt(max) {
                let min = 0;
                max = Math.floor(max);
                //The maximum is exclusive and the minimum is inclusive
                return Math.floor(Math.random() * (max - min) + min);
            }
            

            // Create all interesting powers of 2.
            let values: number[] = [];
            for( let exp of range(this.bitsize + 3)) {
                values.push(1 << exp)
            }

            // Add some random values.
            for( let i of range(this.bitsize)) {
                let val = 0
                for( let j of range(this.bytesize)) {
                    val = (val << 8) | randomInt(256)
                }
                values.push(val)
            }

            values = [...values,...[300, 700000, (Math.pow(2, 63) - 1) * 4]];

            // Try all those, and their negations, and +-1 from
            // them.  Note that this tests all power-of-2
            // boundaries in range, and a few out of range, plus
            // +-(2**n +- 1).
            for( let base of values ) {
                for( let val of [-base, base]) {
                    for( let incr of [-1, 0, 1] ) {
                        let x = val + incr
                        this._test_one(x)
                    }
                }
            }

            // TODO: Some Python tests are excluded from here. Find JS equivalents if needed
            expect(() => {
                jpstruct.pack(this.format, "a string");
            }).toThrow(TypeError);
            expect(() => {
                // @ts-expect-error Explicitly testing invalid argument
                jpstruct.pack(this.format, randomInt);
            }).toThrow(TypeError);

        }
    
    };

    for(let [code,byteorder] of iter_integer_formats()) {
        let format = byteorder+code;
        it(`Passes integer checks for format: ${format}`, function() {
            let test = new IntTester(byteorder,code);
            test.run();
        });
    }

    it('Throws for values beyond int64 max sizes', function() {
        expect(() => {
            jpstruct.pack('<q',-9223372036854775810n);
        }).toThrow(Error);
    });
});

describe("Test nN codes", function () {
    it("throws for invalid formats", function () {
        ["n", "N"].forEach((code) => {
            ["=", "<", ">", "!"].forEach((byteOrder) => {
                const format = `${byteOrder}${code}`;
                expect(() => jpstruct.calcsize(format)).toThrow(Error);
                expect(() => jpstruct.pack(format, 0)).toThrow(Error);
                expect(() => jpstruct.unpack(format, Uint8Array.from([0]))).toThrow(Error);
            });
        });
    });
});

describe.skip("Test p code", function () {
    function b(arr) {
        const numArr = arr.map(e => (typeof e === 'number' ? e : e.charCodeAt(0)));
        return Uint8Array.from(numArr);
    }

    const test_cases: [string, string, Uint8Array, string][] = [
        ['p', 'abc', b([0]), ''],
        ['1p', 'abc', b([0]), ''],
        ['2p', 'abc', b([1, 'a']), 'a'],
        ['3p', 'abc', b([2, 'a', 'b']), 'ab'],
        ['4p', 'abc', b([3, 'a', 'b', 'c']), 'abc'],
        ['5p', 'abc', b([3, 'a', 'b', 'c', 0]), 'abc'],
        ['6p', 'abc', b([3, 'a', 'b', 'c', 0, 0]), 'abc'],
        ['1000p', 'x'.repeat(1000), b([255, ...Array(999).fill('x')]), 'x'.repeat(255)]
    ];

    test_cases.forEach(([format, arg, expected, result]) => {
        it(`Encodes with format "${format}"`, function () {
            const packed = jpstruct.pack(format, arg);
            expect(packed).toStrictEqual(expected);
            const unpacked = jpstruct.unpack(format, packed);
            expect(unpacked).toStrictEqual(result);
        });
    });
    
});

describe('Test 705836', function() {
    /* SF bug 705836.  "<f" and ">f" had a severe rounding bug, where a carry
       from the low-order discarded bits could propagate into the exponent
       field, causing the result to be wrong by a factor of 2.
    */
    for( const base of [...Array(33).keys()] ) {
        it(`Passes for base of ${base}`, function() {
            // smaller <- largest representable float less than base.
            let delta = 0.5;
            while( base - delta / 2.0 != base) {
                delta /= 2.0;
            }
            let smaller = base - delta;
            // Packing this rounds away a solid string of trailing 1 bits.
            let packed = jpstruct.pack("<f", smaller);
            let unpacked = jpstruct.unpack("<f", packed)[0];
            // This failed at base = 2, 4, and 32, with unpacked = 1, 2, and
            // 16, respectively.
            if (base === 0) {
                console.warn(smaller, packed, unpacked);
            }
            expect(base).toStrictEqual(unpacked);
            const bigpacked = jpstruct.pack(">f", smaller);
            packed.reverse();
            expect(bigpacked).toStrictEqual(packed);
            unpacked = jpstruct.unpack(">f", bigpacked)[0];
            expect(base).toStrictEqual(unpacked);

            // Largest finite IEEE single.
            let big = (1 << 24) - 1;
            big = big * 2**(127 - 23);
            packed = jpstruct.pack(">f", big);
            unpacked = jpstruct.unpack(">f", packed)[0];
            expect(big).toStrictEqual(unpacked);

            // The same, but tack on a 1 bit so it rounds up to infinity.
            big = (1 << 25) - 1
            big = big * 2**(127 - 24);
            /* TODO: Should this be enabled?
            expect(() => {
                jpstruct.pack(">f", big);
            }).toThrow(RangeError);
            */
        });
    }
});

describe('Test coercion of floats', function() {
    for( let [code, byteorder] of iter_integer_formats() ) {
        const format = byteorder + code
        it(`Passes for format ${format}`, function() {
            /* Disabled to allow for type coercion when Number.isInteger
            expect(() => {
                jpstruct.pack(format,1.0);
            }).toThrow(Error);
            */
            expect(() => {
                jpstruct.pack(format,1.5);
            }).toThrow(Error);
            /* Disabled to allow for type coercion when Number.isInteger
            expect(() => {
                jpstruct.pack('P',1.0);
            }).toThrow(Error);
            */
            expect(() => {
                jpstruct.pack('P',1.5);
            }).toThrow(Error);
        });
    }
});

describe('Test unpack_from', function() {
    function b(str: string) {
        return Uint8Array.from([...str].map(e => e.charCodeAt(0)));
    }

    function range(n: number, m?: number) {
        if( m === undefined ) {
            return [...Array(n).keys()];
        }
        else {
            return [...Array(m).keys()].slice(n);
        }
    }
 
    const data = b('abcd01234');
    const fmt = '4s';

    it('Unpacks at offsets from a class', function() {
        const s = new jpstruct.Struct(fmt);
        expect(s.unpack_from(data   )).toStrictEqual(['abcd']);
        expect(s.unpack_from(data, 2)).toStrictEqual(['cd01']);
        expect(s.unpack_from(data, 4)).toStrictEqual(['0123']);
        for(let i of range(6)) {
            expect(s.unpack_from(data, i)).toStrictEqual(
                [new TextDecoder().decode(data.slice(i, i + 4))]
            );
        }
        
        for( let i of range(6, data.length + 1)) {
            expect(() => {
                s.unpack_from(data, i);
            }).toThrow();
        }
    });
 
    it('Unpacks at offsets called directly', function() {
        expect(jpstruct.unpack_from(fmt, data   )).toStrictEqual(['abcd']);
        expect(jpstruct.unpack_from(fmt, data, 2)).toStrictEqual(['cd01']);
        expect(jpstruct.unpack_from(fmt, data, 4)).toStrictEqual(['0123']);
        for(let i of range(6)) {
            expect(jpstruct.unpack_from(fmt, data, i)).toStrictEqual(
                [new TextDecoder().decode(data.slice(i, i + 4))]
            );
        }
        
        for( let i of range(6, data.length + 1)) {
            expect(() => {
                jpstruct.unpack_from(fmt,data, i);
            }).toThrow();
        }
    });

});

describe('Test pack into', function() {
    function b(str) {
        return Uint8Array.from([...str].map(e => e.charCodeAt(0)));
    }

    function range(n,m=undefined) {
        if( m === undefined ) {
            return [...Array(n).keys()];
        }
        else {
            return [...Array(m).keys()].slice(n);
        }
    }

    const test_string = b('Reykjavik rocks, eow!');
    
    const fmt = '21s'
    const s = new jpstruct.Struct(fmt)
    let writable_buf = new Uint8Array(100);

    it('Packs without offset', function() {
        s.pack_into(writable_buf, 0, test_string);
        let from_buf = writable_buf.slice(0,test_string.length);
        expect(from_buf).toEqual(test_string);
    });

    it('Packs with offset', function() {
        s.pack_into(writable_buf, 10, test_string);
        let from_buf = writable_buf.slice(0,test_string.length+10);
        expect(from_buf).toEqual(Uint8Array.from([...test_string.slice(0,10),...test_string]));
    });

    it('Throws going over boundaries', function() {
        let small_buf = new Uint8Array(10);;
        expect(() => {
            s.pack_into(small_buf, 0, test_string);
        }).toThrow();
        expect(() => {
            s.pack_into(small_buf, 2, test_string);
        }).toThrow();
    });

    it('Deals with bogus offsets', function() {
        let small_buf = new Uint8Array(10);
        expect(() => {
            jpstruct.pack_into('h', small_buf, undefined);
        }).toThrow(TypeError);
    });

});

describe('Test bool', function() {
    const falsy = ['', 0, null, NaN];
    const truthy = [[1], 'test', 5, -1, 0xffffffff+1, 0xffffffff/2, []];

    for(let prefix of [...'<>!=','']) {
        it(`Passes for prefix ${prefix}`, function() {
        const falseFormat = prefix + ('?'.repeat(falsy.length));
        const packedFalse = jpstruct.pack(falseFormat, ...falsy)
        const unpackedFalse = jpstruct.unpack(falseFormat, packedFalse)

        expect(falsy.length).toEqual(unpackedFalse.length);
        unpackedFalse.forEach( e => expect(e).toBe(false));

        const trueFormat = prefix + ('?'.repeat(truthy.length));
        const packedTrue = jpstruct.pack(trueFormat, ...truthy)
        const unpackedTrue = jpstruct.unpack(trueFormat, packedTrue)

        expect(truthy.length).toEqual(unpackedTrue.length);
        unpackedTrue.forEach( e => expect(e).toBe(true));


        let packed = jpstruct.pack(prefix+'?', 1);

        expect(packed.length).toEqual(jpstruct.calcsize(prefix+'?'));

        expect(packed.length).toEqual(1);

        });
    }

    it('Unpacks multiple true bits as true', function() {
        function b(arr) {
            const numArr = arr.map(e => (typeof e === 'number' ? e : e.charCodeAt(0)) );
            return Uint8Array.from(numArr);
        }
        for(let c of [b([0x01]), b([0x7f]), b([0xff]), b([0x0f]), b([0xf0])] ) {
            expect(jpstruct.unpack('>?', c)[0]).toBe(true);
        }
    });

});

describe("Test trailing counter", function () {
    const test_formats = [
        "12345", "c12345", "14s42"
    ];

    test_formats.forEach((format) => {
        it(`Fails with format "${format}"`, function () {
            expect(() => jpstruct.pack(format)).toThrow(Error);
            expect(() => jpstruct.unpack(format, new Uint8Array())).toThrow(Error);
            expect(() => jpstruct.pack_into(format, new Uint8Array(), 0)).toThrow(Error);
            expect(() => jpstruct.unpack_from(format, new Uint8Array())).toThrow(Error);
        });
    });
})

describe('Test signed/unsigned int64:', function() {

    // Number 0xffa0ffe1ffff, packed with Python struct:
    // little endian:
    // 0xff, 0xff, 0xe1, 0xff, 0xa0, 0xff, 0x00, 0x00
    // big endian:
    // 0x00, 0x00, 0xff, 0xa0, 0xff, 0xe1, 0xff, 0xff

    it('pack <Q', function() {
        let got = jpstruct.pack('<Q', 281066952851455n);
        let bytes = [...(new Uint8Array(got))];
        expect(bytes).toStrictEqual([0xff, 0xff, 0xe1, 0xff, 0xa0, 0xff, 0x00, 0x00]);
    });

    it('unpack <Q', function() {
        var unpacked = jpstruct.unpack('<Q', new Uint8Array([0xff, 0xff, 0xe1, 0xff, 0xa0, 0xff, 0x00, 0x00]) );
        expect(unpacked.length).toEqual(1);
        expect(unpacked[0]).toEqual(281066952851455n);
    });

    // Test lower-case q as well. As number is less than 2^63, same result
    it('unpack <q (signed)', function() {
        var unpacked = jpstruct.unpack('<q', new Uint8Array([0xff, 0xff, 0xe1, 0xff, 0xa0, 0xff, 0x00, 0x00]) );
        expect(unpacked.length).toEqual(1);
        expect(unpacked[0]).toEqual(281066952851455n);
    });

});

//32 bits
function dec2bin(dec: number){
    var x = (dec >>> 0).toString(2);
    const y = ("00000000000000000000000000000000" + x).slice(-32)
    const y1 = y.substring(0,8);
    const y2 = y.substring(8,16);
    const y3 = y.substring(16,24);
    const y4 = y.substring(24,32);
    return [y, y1, y2, y3, y4];
}
function dec2bin_ws(dec) {
        var str = dec2bin(dec);
        var bb = str.slice(1); //1-4 skipping zero
        var bbj = bb.join(' ');
    return bbj;
}

describe('MAVLink tests:', function() {

    it('IBB buzz', function() { // should work in range 0-255 if u use 'binary' encoding

        //from device_op_write

        const format = '<IBBBBBBB';

        const request_id = 963497464; // fieldtype: uint32_t  isarray: False 
        const target_system = 17; // fieldtype: uint8_t  isarray: False 
        const target_component = 84; // fieldtype: uint8_t  isarray: False 
        const bustype = 151; // fieldtype: uint8_t  isarray: False 
        const bus = 218; // fieldtype: uint8_t  isarray: False 
        const address = 29; // fieldtype: uint8_t  isarray: False 
        const regstart = 216; // fieldtype: uint8_t  isarray: False 
        const count = 27; // fieldtype: uint8_t  isarray: False 
        
        let orderedfields = [ request_id, target_system, target_component, bustype, bus, address, regstart, count];

        let buf = jpstruct.pack(format, ...orderedfields);
        
        let reference = [0xf8, 0xcd, 0x6d, 0x39, 0x11, 0x54, 0x97, 0xda, 0x1d, 0xd8, 0x1b]; // while ref packet

        let bytes = [...buf];
        expect(bytes).toStrictEqual(reference);

    });

    it('signed 8-bit outside of -127-127 range', function() { 

        //from end of sys_status

        const format = '<b';
        const battery_remaining =  223;

        let ui8 = (new Int8Array([battery_remaining]))[0]; // cast value that is clearly outside the -127-0-127 range to signed data

        let orderedfields = [ ui8 ];
        let buf = jpstruct.pack(format, ...orderedfields);

        let bytes = [...buf];
        expect(bytes).toStrictEqual([ 223 ]);
    });


    it('32 bit overflow buzz', function() { // should work in range 0-255 if u use 'binary' encoding

        //from aoa_ssa

        let format = '<Q';

        const ui64 = 93372036854775807n

        // according to the internet 93372036854775807 =  00000001 01001011 10111001 01011111 01110000 10101110 11111111 11111111

        const orderedfields = [ ui64 ];

        let buf = jpstruct.pack(format, ...orderedfields);

        let bytes = [...buf];

        let body = [ 0xff, 0xff, 0xae, 0x70, 0x5f, 0xb9, 0x4b, 0x01 ];  // expected result
        expect(bytes).toStrictEqual(body);
    });


    it('ftp ascii buzz', function() { // should work in range 0-255 if u use 'binary' encoding

        //from file_transfer_protocol

        const format = '<BBB251s';

        const target_network = 5; // fieldtype: uint8_t  isarray: False 
        const target_system = 72; // fieldtype: uint8_t  isarray: False 
        const target_component = 139; // fieldtype: uint8_t  isarray: False 
        const payload = Uint8Array.from([206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200]); // fieldtype: uint8_t  isarray: True 

        const orderedfields = [ target_network, target_system, target_component, payload ];

        let buf = jpstruct.pack(format, ...orderedfields); 

        var body = [ 0x05, 0x48, 0x8b, 0xce, 0xcf, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde, 0xdf, 0xe0, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb, 0xec, 0xed, 0xee, 0xef, 0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe, 0xff, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f, 0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f, 0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x5b, 0x5c, 0x5d, 0x5e, 0x5f, 0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f, 0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x7b, 0x7c, 0x7d, 0x7e, 0x7f, 0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8d, 0x8e, 0x8f, 0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f, 0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xab, 0xac, 0xad, 0xae, 0xaf, 0xb0, 0xb1, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xbb, 0xbc, 0xbd, 0xbe, 0xbf, 0xc0, 0xc1, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8];

        let bytes = [...buf];
        expect(bytes).toStrictEqual(body);
    });


    it('jpg thing buzz', function() { // should work in range 0-255 if u use 'binary' encoding

        //from data_transmission_handshake

        const format = '<IHHHBBB';

        const size = 963497464; // fieldtype: uint32_t  isarray: False 
        const width = 17443; // fieldtype: uint16_t  isarray: False 
        const height = 17547; // fieldtype: uint16_t  isarray: False 
        const packets = 17651; // fieldtype: uint16_t  isarray: False 
        const type = 163; // fieldtype: uint8_t  isarray: False 
        const payload = 230; // fieldtype: uint8_t  isarray: False 
        const jpg_quality = 41; // fieldtype: uint8_t  isarray: False 

        var orderedfields = [ size, width, height, packets, type, payload, jpg_quality];

        var buf = jpstruct.pack(format, ...orderedfields);
      
        var body = [0xf8, 0xcd, 0x6d, 0x39, 0x23, 0x44, 0x8b, 0x44, 0xf3, 0x44, 0xa3, 0xe6, 0x29];

        let bytes = [...buf];
        expect(bytes).toStrictEqual(body);
    });



    it('header thing buzz', function() {

        // header 10 bytes from 'encode data_transmission_handshake from C'

        //    var orderedfields =  [253, this.mlen, this.incompat_flags, this.compat_flags, this.seq, this.srcSystem, this.srcComponent, ((this.msgId & 0xFF) << 8) | ((this.msgId >> 8) & 0xFF), this.msgId>>16];

        const msgId = 130;

        var v1 = ((msgId & 0xFF) << 8) | ((msgId >> 8) & 0xFF);
        var v2 = msgId>>16;

        expect(v1).toEqual(33280);
        expect(v2).toEqual(0);

        var orderedfields =  [253,13,0,0,40,11,10,33280,0];

        var buf =  jpstruct.pack('<BBBBBBBHB',...orderedfields);

        let body = [0xfd, 0x0d, 0x00, 0x00, 0x28, 0x0b, 0x0a, 0x00, 0x82, 0x00];

        let bytes = [...buf];
        expect(bytes).toStrictEqual(body);
    });

    it('Supports whitespace in format strings', function() {

        const msgId = 130;

        var v1 = ((msgId & 0xFF) << 8) | ((msgId >> 8) & 0xFF);
        var v2 = msgId>>16;

        expect(v1).toEqual(33280);
        expect(v2).toEqual(0);

        var orderedfields =  [253,13,0,0,40,11,10,33280,0];

        var buf =  jpstruct.pack(`<B B  BBBB
            BHB`,...orderedfields);

        let body = [0xfd, 0x0d, 0x00, 0x00, 0x28, 0x0b, 0x0a, 0x00, 0x82, 0x00];

        let bytes = [...buf];
        expect(bytes).toStrictEqual(body);
    });


});

describe('Q Boundary tests:', function() {

    it('unpack <Q full', function() {
        let unpacked = jpstruct.unpack('<Q', new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]) );
        expect(unpacked.length).toEqual(1);
        expect(unpacked[0]).toEqual(18446744073709551615n);
    });

    it('pack <Q full', function() {
        let buf = jpstruct.pack('<Q', 18446744073709551615n);
        let bytes = [...buf];
        expect(bytes).toEqual([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    });

    it('unpack <Q zero', function() {
        let unpacked = jpstruct.unpack('<Q', new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]));
        expect(unpacked.length).toEqual(1);
        expect(unpacked[0]).toEqual(0n);
    });

    it('pack <Q zero', function() {
        let buf = jpstruct.pack('<Q', 0n);
        let bytes = [...buf];
        expect(bytes).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it('unpack <Q one', function() {
        let unpacked = jpstruct.unpack('<Q', new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1]));
        expect(unpacked.length).toEqual(1);
        expect(unpacked[0]).toEqual(72340172838076673n);
    });

    it('pack <Q one', function() {
        let buf = jpstruct.pack('<Q', 72340172838076673n);
        let bytes = [...buf];
        expect(bytes).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    });

    it('unpack <Q 0xfe', function() {
        let unpacked = jpstruct.unpack('<Q', new Uint8Array([0xfe, 0xfe, 0xfe, 0xfe, 0xfe, 0xfe, 0xfe, 0xfe]));
        expect(unpacked.length).toEqual(1);
        expect(unpacked[0]).toEqual(18374403900871474942n);
    });

    it('pack <Q 0xfe', function() {
        let buf = jpstruct.pack('<Q', 18374403900871474942n);
        let bytes = [...buf];
        expect(bytes).toStrictEqual([0xfe, 0xfe, 0xfe, 0xfe, 0xfe, 0xfe, 0xfe, 0xfe]);
    });

});

describe("String tests", function () {

    it('packs and unpacks a short string', function() {
        const test_string = "Hello";
        let format = '<10s';
        let ascii_bytes = new TextEncoder().encode(test_string);

        let buf = jpstruct.pack(format, ascii_bytes);
        let bytes = [...buf];
        expect(bytes).toStrictEqual([72, 101, 108, 108, 111, 0, 0, 0, 0, 0]);

        let unpacked = jpstruct.unpack(format,new Uint8Array(buf));
        expect(unpacked.length).toEqual(1);
        expect(unpacked[0]).toStrictEqual('Hello\u0000\u0000\u0000\u0000\u0000');

    });

    it('packs and unpacks a too long string', function() {
        const test_string = "Hello";
        let format = '<3s';
        let ascii_bytes = new TextEncoder().encode(test_string);

        let buf = jpstruct.pack(format, ascii_bytes);
        let bytes = [...buf];
        expect(bytes).toStrictEqual([72, 101, 108 ]);

        let unpacked = jpstruct.unpack(format,new Uint8Array(buf));
        expect(unpacked.length).toEqual(1);
        expect(unpacked[0]).toStrictEqual("Hel");

    });

    it('pack <4s correctly over the ascii 127->128->129 boundary', function() {
        let format = '<4s';
        let ascii_bytes = Uint8Array.from([ 126, 127, 128, 129]);

        let buf = jpstruct.pack(format, ascii_bytes);
        let bytes = [...buf];
        expect(bytes).toStrictEqual([0x7e, 0x7f, 0x80, 0x81]);

    });

});
