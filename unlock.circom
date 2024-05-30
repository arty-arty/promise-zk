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
    signal input address, k, hash_k, aH_x, aH_y;
    signal output kaH_x, kaH_y;
    
    address * 0 === 0;
    
     // Check that k is not zero i.e it actually has an inverse
    signal k_inv;
    k_inv <-- k!=0 ? 1/k : 0;
    k_inv*k === 1; 

    component check_aH = BabyCheck();
    check_aH.x <== aH_x;
    check_aH.y <== aH_y;
     
    // Check the hash_k
    component hash_check = Poseidon(1);
    hash_check.inputs[0] <== k;
    hash_check.out === hash_k;

    // Calculate output kaH_x, kaH_y
    component mml_k_aH = MyMul();
    mml_k_aH.coeff <== k;
    mml_k_aH.x <== aH_x;
    mml_k_aH.y <== aH_y;

    mml_k_aH.xout ==> kaH_x;
    mml_k_aH.yout ==> kaH_y;
}

component main { public [ address, hash_k, aH_x, aH_y ] } = Example();

/* INPUT = {
    "address": "1337",

    "k"  : "21888242871839275222246405745257275088614511777268538073601725287587578984328",
    "hash_k": "21356175538921533842148623498297006446606795514370596108568498988367850556518",

    "aH_x":   "13588561575246442548455582745542485234097730117018791270902675311173615549288",
    "aH_y":   "308111687958528632616916277249447030871128397260475082311634915123542597200"
} */
