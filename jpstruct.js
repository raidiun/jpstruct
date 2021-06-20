/*

ECMA module to emulate Python's struct
Minimal for MAVLink work

*/

function is_platform_littleendian() {
    // Stolen from: https://abdulapopoola.com/2019/01/20/check-endianness-with-javascript/
    const uint32Array = new Uint32Array([0x11223344]);
    const uint8Array = new Uint8Array(uint32Array.buffer);

    if(uint8Array[0] === 0x44) {
        return true;
    }
    else if( uint8Array[0] === 0x11 ) {
        return false;
    }

    throw new Error('Unknown endianness');
}

export class Struct {
    static _format_lookup = {
            "x": [1,() => undefined, () => {}],
            "c": [1,unpack_char,pack_char],
            "b": [1,unpack_signed_char,pack_signed_char],
            "B": [1,unpack_unsigned_char,pack_unsigned_char],
            "?": [1,unpack_bool,pack_bool],
            "h": [2,unpack_short,pack_short],
            "H": [2,unpack_unsigned_short,pack_unsigned_short],
            "i": [4,unpack_int,pack_int],
            "I": [4,unpack_unsigned_int,pack_unsigned_int],
            "l": [4,unpack_int,pack_int],
            "L": [4,unpack_unsigned_int,pack_unsigned_int],
            "q": [8,unpack_long_long,pack_long_long],
            "Q": [8,unpack_unsigned_long_long,pack_unsigned_long_long],
            "f": [4,unpack_float,pack_float],
            "d": [8,unpack_double,pack_double],
        };

    static _format_element_pattern = "(\\d+)?([AxcbBhHsfdiIlLqQ?])";
    static _format_pattern = "^[@=<>!]?((\\d+)?([AxcbBhHsfdiIlLqQ?]))+$";

    static _is_format_littleendian(format) {
        switch( format[0] ) {
            case('<'):
                return true;
            case('>'):
            case('!'):
                return false;
            case('@'):
            case('='):
            default:
                return is_platform_littleendian();
        }
    }

    constructor(format) {
        const formatRegex = new RegExp(Struct._format_pattern);
        if( ! formatRegex.test(format) ) {
            throw new Error("Invalid format string");
        }
        this.format = format;
        this.size = this._calc_size();
        this.littleEndian = Struct._is_format_littleendian(format);
    }

    _calc_size() {
        let result = 0;

        let re = new RegExp(Struct._format_element_pattern,"g");
        let match;
        while( (match = re.exec(this.format)) !== null ) {

            let count = 1;
            if( match[1] !== undefined && match[1] !== "") {
                // Format string defines a count
                count = parseInt(match[1]);
            }

            if( match[2] == "s" ) {
                // For strings, the count is special
                result += count;
                continue;
            }

            for(let repeats = 0; repeats < count; repeats++) {
                let [size,unpack_func,pack_func] = Struct._format_lookup[match[2]];
                result += size;
            }
        }

        return result;
    }

    // Pack arguments according to format
    //  Returns: Uint8Array
    // ...varargs: any - Arguments to pack
    pack(...varargs) {
        let buffer = new Uint8Array(this.size);
        this.pack_into(buffer,0,...varargs);
        return buffer;
    }
    
    // Pack arguments into specified buffer according to format
    // buffer: Uint8Array - Buffer to pack arguments into
    // offset: int - Offset into buffer at which to begin packing
    // ...varargs: any - Arguments to pack
    pack_into(buffer, offset, ...varargs) {
        let view = new DataView(buffer.buffer,buffer.byteOffset+offset);
        let view_index = 0;

        let arg_index = 0;

        let re = new RegExp(Struct._format_element_pattern,"g");
        let match;
        while( (match = re.exec(this.format)) !== null ) {

            if( varargs[arg_index] === undefined ) {
                throw new Error("Insufficient arguments for format string");
            }

            let count = 1;
            if( match[1] !== undefined && match[1] !== "") {
                // Format string defines a count
                count = parseInt(match[1]);
            }

            if( match[2] == "s" ) {
                // For strings, the count is special
                pack_string(view,view_index,count,varargs[arg_index]);
                view_index += count;
                arg_index += 1;
                continue;
            }

            for(let repeats = 0; repeats < count; repeats++) {
                let [size,unpack_func,pack_func] = Struct._format_lookup[match[2]];
                let result = pack_func(view,view_index,varargs[arg_index],this.littleEndian);
                view_index += size;
                arg_index += 1;
            }

            if( match[2] == "x" ) {
                // For padding bytes we shouldn't advance the arg_index
                arg_index -= 1;
            }

        }

        if( arg_index != varargs.length ) {
            throw new Error("Too many arguments provided");
        }

    }

    // Unpack arguments from buffer according to format
    //  Returns: [any]
    // buffer: Uint8Array - Buffer to unpack from
    unpack(buffer) {
        return this.unpack_from(buffer,0);
    }
    
    // Unpack arguments from offset in buffer according to format
    //  Returns: [any]
    // buffer: Uint8Array - Buffer to unpack from
    // offset: int - Offset into buffer at which to begin unpacking
    unpack_from(buffer, offset=0) {
        let view = new DataView(buffer.buffer,buffer.byteOffset+offset);
        let view_index = 0;
        
        let unpacked_values = [];

        let re = new RegExp(Struct._format_element_pattern,"g");
        let match;
        while( (match = re.exec(this.format)) !== null ) {

            let count = 1;
            if( match[1] !== undefined && match[1] !== "") {
                // Format string defines a count
                count = parseInt(match[1]);
            }

            if( match[2] == "s" ) {
                // For strings, the count is special
                let result = unpack_string(view,view_index,count);
                view_index += count;
                if (result !== undefined) {
                    unpacked_values.push(result);
                }
                continue;
            }

            for(let repeats = 0; repeats < count; repeats++) {
                let [size,unpack_func,pack_func] = Struct._format_lookup[match[2]];
                let result = unpack_func(view,view_index,this.littleEndian);
                view_index += size;
                if (result !== undefined) {
                    unpacked_values.push(result);
                }
            }
        }

        return unpacked_values;
    }

}

// Return the bytesize of format
//  Returns: int
// format: string - Format to calculate size of
export function calcsize(format) {
    return (new Struct(format)).size;
}

// Pack arguments according to format
//  Returns: Uint8Array
// format: string - Format to use
// ...varargs: any - Arguments to pack
export function pack(format, ...varargs) {
    return (new Struct(format)).pack(...varargs);
    }

// Pack arguments into specified buffer according to format
// format: string - Format to use
// buffer: Uint8Array - Buffer to pack arguments into
// offset: int - Offset into buffer at which to begin packing
// ...varargs: any - Arguments to pack
export function pack_into(format, buffer, offset, ...varargs) {
    return (new Struct(format)).pack_into(buffer,offset, ...varargs);
}

// Unpack arguments from buffer according to format
//  Returns: [any]
// format: string - Format to use
// buffer: Uint8Array - Buffer to unpack from
export function unpack(format,buffer) {
    return (new Struct(format)).unpack(buffer);
}

// Unpack arguments from offset in buffer according to format
//  Returns: [any]
// format: string - Format to use
// buffer: Uint8Array - Buffer to unpack from
// offset: int - Offset into buffer at which to begin unpacking
export function unpack_from(format,buffer,offset=0) {
    return (new Struct(format)).unpack_from(buffer,offset);
}

// Little-endian unpack routines
function unpack_char(view,offset,littleEndian) {
    return String.fromCharCode(view.getUint8(offset));
}

function unpack_signed_char(view,offset,littleEndian) {
    return view.getInt8(offset);
}

function unpack_unsigned_char(view,offset,littleEndian) {
    return view.getUint8(offset);
}

function unpack_bool(view,offset,littleEndian) {
    return view.getUint8(offset) !== 0;
}

function unpack_short(view,offset,littleEndian) {
    return view.getInt16(offset,littleEndian);
}

function unpack_unsigned_short(view,offset,littleEndian) {
    return view.getUint16(offset,littleEndian);
}

function unpack_int(view,offset,littleEndian) {
    return view.getInt32(offset,littleEndian);
}

function unpack_unsigned_int(view,offset,littleEndian) {
    return view.getUint32(offset,littleEndian);
}

function unpack_long_long(view,offset,littleEndian) {
    return view.getBigInt64(offset,littleEndian);
}

function unpack_unsigned_long_long(view,offset,littleEndian) {
    return view.getBigUint64(offset,littleEndian);
}


function unpack_float(view,offset,littleEndian) {
    return view.getFloat32(offset,littleEndian);
}

function unpack_double(view,offset,littleEndian) {
    return view.getFloat64(offset,littleEndian);
}

function unpack_string(view,offset,length) {
    return new Uint8Array(view.buffer,view.byteOffset+offset,length);
}

// Little-endian pack routines
function pack_char(view,offset,value,littleEndian) {
    view.setUint8(offset,value.charCodeAt(0));
}

function pack_signed_char(view,offset,value,littleEndian) {
    view.setInt8(offset,value);
}

function pack_unsigned_char(view,offset,value,littleEndian) {
    view.setUint8(offset,value);
}

function pack_bool(view,offset,value,littleEndian) {
    view.setUint8(offset,value ? 1 : 0);
}

function pack_short(view,offset,value,littleEndian) {
    view.setInt16(offset,value,littleEndian);
}

function pack_unsigned_short(view,offset,value,littleEndian) {
    view.setUint16(offset,value,littleEndian);
}

function pack_int(view,offset,value,littleEndian) {
    view.setInt32(offset,value,littleEndian);
}

function pack_unsigned_int(view,offset,value,littleEndian) {
    view.setUint32(offset,value,littleEndian);
}

function pack_long_long(view,offset,value,littleEndian) {
    if( typeof value !== 'bigint' ) {
        value = BigInt(value);
    }
    view.setBigInt64(offset,value,littleEndian);
}

function pack_unsigned_long_long(view,offset,value,littleEndian) {
    if( typeof value !== 'bigint' ) {
        value = BigInt(value);
    }
    view.setBigUint64(offset,value,littleEndian);
}

function pack_float(view,offset,value,littleEndian) {
    view.setFloat32(offset,value,littleEndian);
}

function pack_double(view,offset,value,littleEndian) {
    view.setFloat64(offset,value,littleEndian);
}

function pack_string(view,offset,length,value) {
    let destView = new Uint8Array(view.buffer,view.byteOffset+offset,length);
    if( typeof value === 'string' ) {
        const binaryencoder = new TextEncoder('binary');
        let encodeResult = binaryencoder.encodeInto(value,destView);
        if(encodeResult.written < length) {
            destView.fill(0,encodeResult.written);
        }
    }
    else {
        destView.set(value.slice(0,length));
    }
}
