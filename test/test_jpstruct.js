
import 'should';
import * as jpstruct from '../jpstruct.js';

//const integer_codes = ['b', 'B', 'h', 'H', 'i', 'I', 'l', 'L', 'q', 'Q', 'n', 'N' ];
//const byteorders = ['', '@', '=', '<', '>', '!'];

// nN are exluded as they only exist for native byteorders
const integer_codes = ['b', 'B', 'h', 'H', 'i', 'I', 'l', 'L', 'q', 'Q', ];
const byteorders = ['<'];// Only testing explicit little endian for now

// Convert hex chars to equivalent byteArray
function unhexlify(hexdata) {
    var byteArray = new Uint8Array(hexdata.length/2);
    for (var x = 0; x < byteArray.length; x++){
        byteArray[x] = parseInt(hexdata.substr(x*2,2), 16);
    }
    return byteArray
}

describe('Test calcsize', function() {
    let expected_size = {
        'b': 1, 'B': 1,
        'h': 2, 'H': 2,
        'i': 4, 'I': 4,
        'l': 4, 'L': 4,
        'q': 8, 'Q': 8,
        };

    // standard integer sizes
    for(let code of integer_codes) {
        let format = '<'+code;
        it(`Calculates correct size for format: ${format}`, function() {
            let size = jpstruct.calcsize(format);
            size.should.be.eql(expected_size[code]);
        });
    }

});

describe('Test integers', function() {
    class IntTester {
        constructor(format, code) {
            this.format = format;
            this.code = code;
            this.bytesize = jpstruct.calcsize(format);
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
        
        _test_one(x) {
            if( !(this.min_value <= BigInt(x) && BigInt(x) <= this.max_value) ) {
                return;
            }

            // Generate the expected bytestream
            let expected = BigInt(x);
            if( this.signed && x < 0n ) {
                // Convert to unsigned equivalent
                expected += 1n << BigInt(this.bitsize);
            }
            expected.should.be.aboveOrEqual(0n);

            // Get hex representation
            expected = expected.toString(16);
            if( expected.length % 2 == 1 ) {
                expected = "0" + expected;
            }
            
            expected = unhexlify(expected);
            
            expected = [...(new Uint8Array(this.bytesize-expected.length)), ...expected].reverse();
            expected.length.should.be.eql(this.bytesize);

            // Test pack
            let got = jpstruct.pack(this.format,x);
            [...got].should.be.eql(expected);

            // Test unpack
            let retrieved = jpstruct.unpack(this.format,got);
            if( this.code == 'Q' || this.code == 'q' ) {
                retrieved[0].should.be.eql(BigInt(x));    
            }
            else{
                retrieved[0].should.be.eql(x);
            }
        }

        run() {
            this._test_one(1);
            
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
            let values = [];
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

        }
    
    };

    for(let code of integer_codes) {
        let format = '<'+code;
        it(`Passes integer checks for format: ${format}`, function() {
            let test = new IntTester(format,code);
            test.run();
        });
    }
});

describe('Test signed/unsigned int64:', function() {

    // Number 0xffa0ffe1ffff, packed with Python struct:
    // little endian:
    // 0xff, 0xff, 0xe1, 0xff, 0xa0, 0xff, 0x00, 0x00
    // big endian:
    // 0x00, 0x00, 0xff, 0xa0, 0xff, 0xe1, 0xff, 0xff

    it('pack <Q', function() {
        let got = jpstruct.pack('<Q', 281066952851455n);
        let bytes = [...(new Uint8Array(got))];
        bytes.should.be.eql([0xff, 0xff, 0xe1, 0xff, 0xa0, 0xff, 0x00, 0x00]);
    });

    it('unpack <Q', function() {
        var unpacked = jpstruct.unpack('<Q', new Uint8Array([0xff, 0xff, 0xe1, 0xff, 0xa0, 0xff, 0x00, 0x00]) );
        unpacked.length.should.be.eql(1);
        unpacked[0].should.be.eql(281066952851455n);
    });

    // Test lower-case q as well. As number is less than 2^63, same result
    it('unpack <q (signed)', function() {
        var unpacked = jpstruct.unpack('<q', new Uint8Array([0xff, 0xff, 0xe1, 0xff, 0xa0, 0xff, 0x00, 0x00]) );
        unpacked.length.should.be.eql(1);
        unpacked[0].should.be.eql(281066952851455n);
    });

});

//32 bits
function dec2bin(dec){
    var x = (dec >>> 0).toString(2);
    y = ("00000000000000000000000000000000" + x).slice(-32)
    y1 = y.substring(0,8);
    y2 = y.substring(8,16);
    y3 = y.substring(16,24);
    y4 = y.substring(24,32);
    return [y,y1,y2,y3,y4];
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
        bytes.should.be.eql(reference);

    });

    it('signed 8-bit outside of -127-127 range', function() { 

        //from end of sys_status

        const format = '<b';
        const battery_remaining =  223;

        let ui8 = (new Int8Array([battery_remaining]))[0]; // cast value that is clearly outside the -127-0-127 range to signed data

        let orderedfields = [ ui8 ];
        let buf = jpstruct.pack(format, ...orderedfields);

        let bytes = [...buf];
        bytes.should.be.eql([ 223 ]);
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
        bytes.should.be.eql(body);
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
        bytes.should.be.eql(body);
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
        bytes.should.be.eql(body);
    });



    it('header thing buzz', function() {

        // header 10 bytes from 'encode data_transmission_handshake from C'

        //    var orderedfields =  [253, this.mlen, this.incompat_flags, this.compat_flags, this.seq, this.srcSystem, this.srcComponent, ((this.msgId & 0xFF) << 8) | ((this.msgId >> 8) & 0xFF), this.msgId>>16];

        this.msgId = 130;

        var v1 = ((this.msgId & 0xFF) << 8) | ((this.msgId >> 8) & 0xFF);
        var v2 = this.msgId>>16;

        v1.should.be.eql(33280);
        v2.should.be.eql(0);

        var orderedfields =  [253,13,0,0,40,11,10,33280,0];

        var buf =  jpstruct.pack('<BBBBBBBHB',...orderedfields);

        let body = [0xfd, 0x0d, 0x00, 0x00, 0x28, 0x0b, 0x0a, 0x00, 0x82, 0x00];

        let bytes = [...buf];
        bytes.should.be.eql(body);
    });

});

describe('Q Boundary tests:', function() {

    it('unpack <Q full', function() {
        let unpacked = jpstruct.unpack('<Q', new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]) );
        unpacked.length.should.be.eql(1);
        unpacked[0].should.be.eql(18446744073709551615n);
    });

    it('pack <Q full', function() {
        let buf = jpstruct.pack('<Q', 18446744073709551615n);
        let bytes = [...buf];
        bytes.should.be.eql([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    });

    it('unpack <Q zero', function() {
        let unpacked = jpstruct.unpack('<Q', new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]));
        unpacked.length.should.be.eql(1);
        unpacked[0].should.be.eql(0n);
    });

    it('pack <Q zero', function() {
        let buf = jpstruct.pack('<Q', 0n);
        let bytes = [...buf];
        bytes.should.be.eql([0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it('unpack <Q one', function() {
        let unpacked = jpstruct.unpack('<Q', new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1]));
        unpacked.length.should.be.eql(1);
        unpacked[0].should.be.eql(72340172838076673n);
    });

    it('pack <Q one', function() {
        let buf = jpstruct.pack('<Q', 72340172838076673n);
        let bytes = [...buf];
        bytes.should.be.eql([1, 1, 1, 1, 1, 1, 1, 1]);
    });

    it('unpack <Q 0xfe', function() {
        let unpacked = jpstruct.unpack('<Q', new Uint8Array([0xfe, 0xfe, 0xfe, 0xfe, 0xfe, 0xfe, 0xfe, 0xfe]));
        unpacked.length.should.be.eql(1);
        unpacked[0].should.be.eql(18374403900871474942n);
    });

    it('pack <Q 0xfe', function() {
        let buf = jpstruct.pack('<Q', 18374403900871474942n);
        let bytes = [...buf];
        bytes.should.be.eql([0xfe, 0xfe, 0xfe, 0xfe, 0xfe, 0xfe, 0xfe, 0xfe]);
    });

});

describe("String tests", function () {

    it('packs and unpacks a short string', function() {
        const test_string = "Hello";
        let format = '<10s';
        let ascii_bytes = Uint8Array.from(test_string, (e) => e.charCodeAt(0));

        let buf = jpstruct.pack(format, ascii_bytes);
        let bytes = [...buf];
        bytes.should.be.eql([72, 101, 108, 108, 111, 0, 0, 0, 0, 0]);

        let unpacked = jpstruct.unpack(format,new Uint8Array(buf));
        unpacked.length.should.be.eql(1);
        unpacked[0].should.be.eql(Uint8Array.from([...ascii_bytes,...(new Uint8Array(5))]));

    });

    it('packs and unpacks a too long string', function() {
        const test_string = "Hello";
        let format = '<3s';
        let ascii_bytes = Uint8Array.from(test_string, (e) => e.charCodeAt(0));

        let buf = jpstruct.pack(format, ascii_bytes);
        let bytes = [...buf];
        bytes.should.be.eql([72, 101, 108 ]);

        let unpacked = jpstruct.unpack(format,new Uint8Array(buf));
        unpacked.length.should.be.eql(1);
        unpacked[0].should.be.eql(new Uint8Array(ascii_bytes.slice(0,3)));

    });

    it('pack <4s correctly over the ascii 127->128->129 boundary', function() {
        let format = '<4s';
        let ascii_bytes = Uint8Array.from([ 126, 127, 128, 129]);

        let buf = jpstruct.pack(format, ascii_bytes);
        let bytes = [...buf];
        bytes.should.be.eql([ 0x7e, 0x7f, 0x80, 0x81]);

    });

});
