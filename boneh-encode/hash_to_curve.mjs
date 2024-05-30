// Here I implemented a simple "try and increment" method of hashing to elliptic curve from 
// Dan Boneh, Ben Lynn, and Hovav Shacham. Short signatures from the weil pairing. J. Cryptology, 17(4):297–319, 2004
import { ZqField, Scalar } from "ffjavascript";
import { shake128 } from 'js-sha3';

// This is our BabyJubJub Finite Field prime modulus
const r = Scalar.fromString("21888242871839275222246405745257275088548364400416034343698204186575808495617");
const F = new ZqField(r);
//console.log(F.bitLength);

function message_to_field(F, message) {
    const hash = shake128.array(message, F.bitLength * 2 + 8);
    const nBytes = (F.bitLength * 2 / 8);
    let res = BigInt(0);
    for (let i = 0; i < nBytes; i++) {
        res = (res << BigInt(8)) + BigInt(hash[i]);
    }
    return res % F.p;
}

// In Montgomery Form our BabyJubJub has an equation
// By^2 = x^3 + A x^2 + x
// Parameters: A = 168698, B = 1
const A = BigInt(168698);

//Take next in our deterministic sequence of different encodings of message. Until square root of x^3 + A x^2 + x becomes computable.
function try_and_increment(F, message) {
    let i = BigInt(0);
    let x, y, y_square, new_message;
    while (true) {
        new_message = i.toString() + message;
        x = message_to_field(F, new_message);
        y_square = F.add(F.add(F.pow(x, 3), F.mul(A, F.square(x, 2))), x);
        y = F.sqrt(y_square);
        if (y != null) break;
        i = i + BigInt(1);
    }
    return { u: x, v: y };
}

//a = 168700
//d = 168696
const a = BigInt(168700);
const d = BigInt(168696);
function double_twisted_point({ x, y }) {
    const dd = F.mul(F.mul(d, F.square(x)), F.square(y));
    const xx = F.div(BigInt(2) * x * y, BigInt(1) + dd);
    const yy = F.div(F.sub(F.square(y), F.mul(a, F.square(x))), F.sub(BigInt(1), dd));
    return { xx, yy }
}

function clear_cofactor({ x, y }) {
    let { x: xx, y: yy } = { x, y }
    for (let index = 0; index < 3; index++) {
        ({ xx, yy } = double_twisted_point({ x: xx, y: yy }));
    }
    return { xx, yy }
}

// A simple invertible substitution transfroms Montgomery points to Edwards points
function montgomery_to_twisted_edwards(u, v) {
    const x = F.div(u, v);
    const y = F.div(F.sub(u, BigInt(1)), F.add(u, BigInt(1)));
    return { x, y }
}

// const { u, v } = try_and_increment(F, "A slightly crazy bear");
// const { x, y } = montgomery_to_twisted_edwards(u, v);
// const { xx, yy } = clear_cofactor({ x, y })
// console.log({ xx, yy })

export function string_to_curve(s) {
    const { u, v } = try_and_increment(F, s);
    const { x, y } = montgomery_to_twisted_edwards(u, v);

    // Now we still need to clear the co-factor to get into a prime order subgroup of BabyJubJub elliptic curve group
    // The co-factor is 8 for this curve, let's do scalar multiplication
    // Now we are in a cyclic subgroup!
    const { xx, yy } = clear_cofactor({ x, y })
    return { xx, yy }
}

//module.exports = { string_to_curve, try_and_increment, montgomery_to_twisted_edwards }
