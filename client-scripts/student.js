const snarkjs = require("snarkjs");
const fs = require("fs");
const { string_to_curve } = require("../boneh-encode/hash_to_curve");
const { ZqField, Scalar } = require("ffjavascript");

const { vkey_serialize, vkey_prepared_serialize, proof_serialize, public_input_serialize } = require("../ark-serializer/pkg_node");

const { localnetConnection, testnetConnection, TransactionBlock, Ed25519Keypair, JsonRpcProvider, RawSigner, mnemonicToSeed, Ed25519PublicKey, hasPublicTransfer } = require('@mysten/sui.js');
const { BCS, getSuiMoveConfig } = require("@mysten/bcs");
const { exit } = require("process");

const bcs = new BCS(getSuiMoveConfig());

//!!Please notice that it must be kept secret!!
//Key is a random number less than cyclic subgroup order 2736030358979909402780800718157159386076813972158567259200215660948447373041
const r = Scalar.fromString("2736030358979909402780800718157159386076813972158567259200215660948447373041");
const F = new ZqField(r);
const student_key = F.random().toString();

require('dotenv').config();
const mnemonic = process.env.PHRASE;
const net = process.env.NET;

//!!End of must be kept secret section!!

const verifier_pkg = fs.readFileSync('package.id', 'utf8').trim();
//const verifier_pkg = "0x3113d2573a1825ad48d457b5c998a25bd5a49ed4046d143f83cc0f8a58c69195";

function arr_to_bigint(arr) {
    //let arr = new Uint8Array(buf);
    let result = BigInt(0);
    for (let i = arr.length - 1; i >= 0; i--) {
        result = result * BigInt(256) + BigInt(arr[i]);
    }
    return result;
}

function arr_from_hex(hexString) {
    const _hexString = hexString.replace("0x", "");
    console.log(_hexString);
    const hex = Uint8Array.from(Buffer.from(_hexString, 'hex'));
    console.log(hex);
    return hex;
}

function addr_to_bigint(addr) {
    const interm = arr_from_hex(addr);
    //Zeroize the last - most significant byte of address to prevent the number being bigger than base Field modulo
    interm[31] = 0;
    return arr_to_bigint(interm);
}

const utf8_hex_to_int = (by) => {
    const st = Buffer.from(by).toString('utf8');
    //console.log({ st })
    const arr = Uint8Array.from(Buffer.from(st, 'hex'));
    //console.log({ arr })
    return arr_to_bigint(arr)
}

async function answer_quest(quest_id, student_answer) {

    const { xx: student_H_x, yy: student_H_y } = string_to_curve(student_answer);

    const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
    const net = process.env.NET;
    const connection = (net == "testnet") ? testnetConnection : mainnetConnection;
    const provider = new JsonRpcProvider(connection);

    const signer = new RawSigner(keypair, provider);

    const addr = await signer.getAddress()
    const addr_for_proof = addr_to_bigint(addr).toString();
    console.log(addr_for_proof);

    //BEGIN: Generate commit proof for student answer point on elliptic curve//
    const { proof: proof_commit, publicSignals: publicSignals_commit } = await snarkjs.groth16.fullProve({ address: addr_for_proof, a: student_key, P_x: student_H_x, P_y: student_H_y }, "compiled_circuits/commit_main.wasm", "compiled_circuits/commit_main.groth16.zkey");
    console.log({ student_H_x, student_H_y, proof: JSON.stringify(proof_commit), publicSignals_commit })

    const proof_commit_serialized = proof_serialize(JSON.stringify(proof_commit));
    console.log({ proof_commit_serialized })

    //Now serialzie with my ark-serialize the public inputs    
    const signals_commit = publicSignals_commit.map((input) => public_input_serialize(input))
    console.log({ signals_commit })

    const [student_a_hash_int, student_aH_x_int, student_aH_y_int,] = publicSignals_commit;
    const [student_a_hash, student_aH_x, student_aH_y,] = signals_commit
    console.log(student_a_hash, student_aH_x, student_aH_y);
    //END: Generate commit proof for student answer point on elliptic curve//

    //Here we must retrieve from Sui api professor_kP_x and professor_kP_y written in this shared Quest object
    //And convert this vector<u8> array the right way into a number for the proving system
    //make it professor_kP_x_int, professor_kP_y_int 
    const { data: { content: quest_object } } = await provider.getObject({
        id: quest_id,
        // fetch the object content field
        options: { showContent: true },
    });
    console.log({ quest_object })
    const { professor_kP_x, professor_kP_y } = quest_object.fields;
    //Convert bytes to utf-8 string
    //Then decode this hex encoded string to bytes
    //Take those bytes and convert to number
    //Take into account that the first byte is the least significant byte
    const professor_kP_x_int = utf8_hex_to_int(professor_kP_x).toString();
    const professor_kP_y_int = utf8_hex_to_int(professor_kP_y).toString();

    console.log({ quest_object, professor_kP_x, professor_kP_y, professor_kP_x_int, professor_kP_y_int });

    //BEGIN: Generate unlock proof of student multiplied professors point with her same key 
    const { proof: proof_unlock, publicSignals: publicSignals_unlock } = await snarkjs.groth16.fullProve({ address: addr_for_proof, k: student_key, hash_k: student_a_hash_int, aH_x: professor_kP_x_int, aH_y: professor_kP_y_int }, "compiled_circuits/unlock_main.wasm", "compiled_circuits/unlock_main.groth16.zkey");
    console.log({ proof: JSON.stringify(proof_unlock), publicSignals_unlock })

    const proof_unlock_serialized = proof_serialize(JSON.stringify(proof_unlock));
    console.log({ proof_unlock_serialized })

    //Now serialzie with my ark-serialize the public inputs    
    const signals_unlock = publicSignals_unlock.map((input) => public_input_serialize(input))
    console.log({ signals_unlock })

    const [akP_x, akP_y, , ,] = signals_unlock
    console.log({ akP_x, akP_y });
    //END: Generate unlock proof of student multiplied professors point with her same key//

    //Send the transaction to the verifier implemented in ../sui-verifier/sources/dev_verifier.moive on-chain smart contract
    const tx = new TransactionBlock();

    //In 1 SUI 1_000_000_000 MIST
    //Just 1000 MIST - a small amount for test; Though in production it reqires 0.1 SUI to deincentivize bruteforcing
    const [coin] = tx.splitCoins(tx.gas, [tx.pure(1000)]);

    //Smart contract method signature of student_answer_question(shared_quest: &mut Quest, c: coin::Coin<SUI>, proof_commit: vector<u8>,
    //student_a_hash: vector<u8>, student_aH_x: vector<u8>, student_aH_y: vector<u8>, 
    //proof_unlock: vector<u8>, akP_x: vector<u8>, akP_y: vector<u8>, ctx: &TxContext)
    tx.moveCall({
        target: verifier_pkg + '::verifier::student_answer_question',
        typeArguments: [],
        arguments: [
            tx.pure(quest_id),
            coin,

            tx.pure(proof_commit_serialized),
            tx.pure(student_a_hash),
            tx.pure(student_aH_x),
            tx.pure(student_aH_y),

            tx.pure(proof_unlock_serialized),
            tx.pure(akP_x),
            tx.pure(akP_y),
        ],
        gasBudget: 10000
    }
    )
    const result = await signer.signAndExecuteTransactionBlock({ transactionBlock: tx });
    console.log({ result });
}

const uploaded_quest_id = fs.readFileSync('quest.id', 'utf8').trim();
console.log(verifier_pkg);
answer_quest(uploaded_quest_id, "Silvio Micali")
