const snarkjs = require("snarkjs");
const fs = require("fs");
const { string_to_curve } = require("../boneh-encode/hash_to_curve");
const { vkey_serialize, vkey_prepared_serialize, proof_serialize, public_input_serialize } = require("../ark-serializer/pkg_node");
require('dotenv').config();
const { localnetConnection, mainnetConnection, testnetConnection, TransactionBlock, Ed25519Keypair, JsonRpcProvider, RawSigner, mnemonicToSeed, Ed25519PublicKey, hasPublicTransfer } = require('@mysten/sui.js');
const { BCS, getSuiMoveConfig } = require("@mysten/bcs");
const { exit } = require("process");

const bcs = new BCS(getSuiMoveConfig());

//Please write verifier_pkg id in package.id text file. Notice it is automatically done when deployed with deploy.js
const verifier_pkg = fs.readFileSync('package.id', 'utf8').trim();
console.log(verifier_pkg);

//!!Please notice that it must be kept secret!!
//In production this oracle code runs on a secure server
//Which only professor - key holder - can access
//Key is a random number less than cyclic subgroup order 2736030358979909402780800718157159386076813972158567259200215660948447373041
const professor_key = "21";
const right_answer = "Silvio Micali"
const { xx: P_x, yy: P_y } = string_to_curve(right_answer);
const mnemonic = process.env.PHRASE;
//!!End of must be kept secret section!!

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

function addr_to_bigint(addr, flush = true) {
    const interm = arr_from_hex(addr);
    //Zeroize the last - most significant byte of address to prevent the number being bigger than base Field modulo
    if (flush) interm[31] = 0;
    return arr_to_bigint(interm);
}

const utf8_hex_to_int = (by) => {
    const st = Buffer.from(by).toString('utf8');
    //console.log({ st })
    const arr = Uint8Array.from(Buffer.from(st, 'hex'));
    //console.log({ arr })
    return arr_to_bigint(arr)
}

const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
const provider = new JsonRpcProvider(mainnetConnection);
const signer = new RawSigner(keypair, provider);

async function prepare() {
    const addr = await signer.getAddress()

    const addr_for_proof = addr_to_bigint(addr).toString();
    console.log(addr_for_proof);

    const { proof: proof_upload_quest, publicSignals: publicSignals_upload_quest } = await snarkjs.groth16.fullProve({ address: addr_for_proof, a: professor_key, P_x, P_y }, "compiled_circuits/commit_main.wasm", "compiled_circuits/commit_main.groth16.zkey");
    console.log({ P_x, P_y, proof_upload_quest: JSON.stringify(proof_upload_quest), publicSignals_upload_quest })

    return { addr, addr_for_proof, proof_upload_quest, publicSignals_upload_quest }
}


async function upload_quest() {
    const { addr, addr_for_proof, proof_upload_quest, publicSignals_upload_quest } = await prepare()

    //Now serialzie with my ark-serialize the proof
    const proof_serialized = proof_serialize(JSON.stringify(proof_upload_quest));
    console.log({ proof_serialized })

    //Now serialzie with my ark-serialize the public inputs    
    const signals = publicSignals_upload_quest.map((input) => public_input_serialize(input))
    console.log({ signals })

    const [professor_k_hash, kP_x, kP_y, _] = signals
    console.log(professor_k_hash, kP_x, kP_y);

    //Check proof
    const vKey = JSON.parse(fs.readFileSync("compiled_circuits/commit_main.groth16.vkey.json"));

    const res = await snarkjs.groth16.verify(vKey, publicSignals_upload_quest, proof_upload_quest);

    if (res === true) {
        console.log("Verification OK");
    } else {
        console.log("Invalid proof");
    }

    //Send the transaction to the verifier implemented in ../sui-verifier/sources/dev_verifier.moive on-chain smart contract
    const tx = new TransactionBlock();

    //Smart contract verifier::professor_create_quest method signature
    //question: vector<u8>, proof:vector<u8>, professor_k_hash: vector<u8>,
    //professor_kP_x: vector<u8>, professor_kP_y: vector<u8>
    tx.moveCall({
        target: verifier_pkg + '::verifier::professor_create_quest',
        typeArguments: [],
        arguments: [
            tx.pure("Who co-invented zero-knowledge proofs? : "),
            tx.pure(proof_serialized),
            tx.pure(professor_k_hash),
            tx.pure(kP_x),
            tx.pure(kP_y),
        ],
        gasBudget: 10000
    }
    )
    const result = await signer.signAndExecuteTransactionBlock({ transactionBlock: tx });
    console.log({ result });

    await new Promise(r => setTimeout(r, 10000));

    //const result = { digest: "3DCpgh2iRkRgbYG8L6mFChez73YWpbKdFh7uMBK6wPXQ" };
    //Lookup this transaction block by digest
    const effects = await provider.getTransactionBlock({
        digest: result.digest,
        // only fetch the effects field
        options: { showEffects: true },
    });

    console.log({ result }, effects, effects.effects.created[0].reference.objectId);
    const created = effects.effects.created.filter(effect => "Shared" in effect.owner)
    console.log(created)
    const quest_id = created[0].reference.objectId;

    fs.writeFile('quest.id', quest_id, (err) => {
        if (err) throw err;
        console.log('Quest ID saved to file!');
    });

    //And fill table_id
}

async function process_answer(quest_id, student_address, student_aH_x, student_aH_y) {
    const { addr, addr_for_proof, proof_upload_quest, publicSignals_upload_quest } = await prepare();
    console.log({ student_address, student_aH_x, student_aH_y });

    const professor_k_hash_int = publicSignals_upload_quest[0];

    //Convert address, student_aH_x, student_aH_y to decimal numbers represented as a string
    //const student_address_int = addr_to_bigint(student_address).toString()
    const student_aH_x_int = utf8_hex_to_int(student_aH_x).toString()
    const student_aH_y_int = utf8_hex_to_int(student_aH_y).toString()

    //BEGIN: Generate unlock proof of professor multiplied student point with her same key 
    const { proof: proof_unlock, publicSignals: publicSignals_unlock } = await snarkjs.groth16.fullProve({ address: addr_for_proof, k: professor_key, hash_k: professor_k_hash_int, aH_x: student_aH_x_int, aH_y: student_aH_y_int }, "compiled_circuits/unlock_main.wasm", "compiled_circuits/unlock_main.groth16.zkey");
    console.log({ proof: JSON.stringify(proof_unlock), publicSignals_unlock })

    const proof_unlock_serialized = proof_serialize(JSON.stringify(proof_unlock));
    console.log({ proof_unlock_serialized })

    //Now serialzie with my ark-serialize the public inputs    
    const signals_unlock = publicSignals_unlock.map((input) => public_input_serialize(input))
    console.log({ signals_unlock })

    const [kaH_x, kaH_y, , ,] = signals_unlock
    console.log({ kaH_x, kaH_y });
    //END: Generate unlock proof of professor multiplied student point with her same key//

    //And send it to the contract for verification
    const tx = new TransactionBlock();

    //Smart contract method signature of professor_score_answer(shared_quest: &mut Quest, student: address, 
    //proof:vector<u8>, professor_out_kaH_x: vector<u8>, professor_out_kaH_y: vector<u8>, ctx: &mut TxContext)
    tx.moveCall({
        target: verifier_pkg + '::verifier::professor_score_answer',
        typeArguments: [],
        arguments: [
            tx.pure(quest_id),
            tx.pure(student_address),

            tx.pure(proof_unlock_serialized),
            tx.pure(kaH_x),
            tx.pure(kaH_y),
        ],
        gasBudget: 10000
    }
    )
    const result = await signer.signAndExecuteTransactionBlock({ transactionBlock: tx }).catch((err) => console.log("We had a transaction error", err));
    console.log({ result });
}

async function table_field_to_answer(quest_id, table_field) {
    const { data: { content: { fields: value } = {} } = {} } = await provider.getObject({
        id: table_field,
        // fetch the object content field
        options: { showContent: true },
    });
    //console.log(value.value.fields)

    const { student_address = '', student_aH_x = '', student_aH_y = '' } = value?.value?.fields ?? {};
    if (student_address != '') await process_answer(quest_id, student_address, student_aH_x, student_aH_y);
}

async function run() {
    let quest_id = null;

    try {
        quest_id = fs.readFileSync('quest.id', 'utf8').trim();
    }
    catch { upload_quest() }


    if (quest_id) {

        while (1 == 1) {
            try {
                const objects = await provider.getDynamicFields({
                    parentId: quest_id,
                    // fetch the object content field
                    //options: { showContent: true },
                });
                const table_id = objects.data[0].objectId;

                //Do below every 10 seconds
                const table_fields = await provider.getDynamicFields({
                    parentId: table_id,
                    // fetch the object content field
                    //options: { showContent: true },
                });
                console.log(table_id, table_fields);

                //Now in parallel launch process all the answers found not just [0]
                table_fields.data.map(async (obj) => await table_field_to_answer(quest_id, obj.objectId).catch((e) => { console.log(e) }));
                await new Promise(r => setTimeout(r, 10000));
                console.log("Looped another time")
            }
            catch (err) {
                console.log("For some reason failed to process answers", err)
            }
        }
    }

}

run()
