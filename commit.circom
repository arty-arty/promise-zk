pragma circom 2.1.4;

include "circomlib/poseidon.circom";
include "circomlib/babyjub.circom";
include "circomlib/escalarmulany.circom";

// include "https://github.com/0xPARC/circom-secp256k1/blob/master/circuits/bigint.circom";

template MyMul() {
    signal input coeff, x, y;
    signal output xout, yout;

     // Convert the a key to bits
    component privKeyBits = Num2Bits(253);
    privKeyBits.in <== coeff;
    
    // a ** P(x, y)
    component c1x = EscalarMulAny(253);
    for (var i = 0; i < 253; i ++) {
        c1x.e[i] <== privKeyBits.out[i];
    }
    c1x.p[0] <== x;
    c1x.p[1] <== y;

    xout <== c1x.out[0];
    yout <== c1x.out[1];
}

template Example () {
    signal input address, a, P_x, P_y;
    signal output hash_a, aP_x, aP_y;
    
    address * 0 === 0;

    // Check that a is not zero i.e it actually has an inverse
    signal a_inv;
    a_inv <-- a!=0 ? 1/a : 0;
    a_inv*a === 1; 

    component check = BabyCheck();
    check.x <== P_x;
    check.y <== P_y;

    component mml = MyMul();
    mml.coeff <== a;
    mml.x <== P_x;
    mml.y <== P_y;

    aP_x <== mml.xout;
    aP_y <== mml.yout;

    component hash = Poseidon(1);
    hash.inputs[0] <== a;
    hash_a <== hash.out;
}

component main { public [ address ] } = Example();

/* INPUT = {
    "address": "1337",
    "a"  : "2736030358979909402780800718157159386076813972158567259200215660948447373041",
    "P_x" : "995203441582195749578291179787384436505546430278305826713579947235728471134",
    "P_y" : "5472060717959818805561601436314318772137091100104008585924551046643952123905"
} */

//https://eips.ethereum.org/EIPS/eip-2494
//https://github.com/iden3/circomlib/blob/master/circuits/babyjub.circom
//https://github.com/iden3/circomlib/blob/master/circuits/escalarmulany.circom
//https://github.com/weijiekoh/elgamal-babyjub/blob/master/circom/decrypt.circom

//On Malleability https://geometry.xyz/notebook/groth16-malleability
//https://xn--2-umb.com/22/groth16/


