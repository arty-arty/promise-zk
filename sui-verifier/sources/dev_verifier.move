module dev::verifier {
    use sui::tx_context::{Self, TxContext};
    use std::vector::{Self, append};
    use std::debug;
    use sui::groth16::{Curve, public_proof_inputs_from_bytes, prepare_verifying_key,
    proof_points_from_bytes, verify_groth16_proof, bn254}; //pvk_from_bytes,
    use sui::hex;
    use sui::url::{Self, Url};
    use std::string::{Self, String};
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::object::{Self, UID};
    use sui::address::{Self};
    use sui::coin::{Self};
    use sui::sui::{SUI};
    use sui::event;
    use sui::dynamic_object_field as ofield;
    use sui::clock::{Self, Clock};

    // The creator bundle: these two packages often go together.
    use sui::package;
    use sui::display;

    struct RewardNFT has key, store{
        id: UID,
        name: String,
        description: String,
        url: Url,
    }

    struct WrongAnswerNFT has key, store{
        id: UID,
    }

    struct Answer has store, drop{
        student_a_hash: vector<u8>, 
        student_aH_x: vector<u8>,   
        student_aH_y: vector<u8>,   
        timestamp_answered: u64, //Deal with it later
        student_address: address,
        akP_x: vector<u8>,          
        akP_y: vector<u8>,
    }

    struct Quest has key, store{
        id: UID,
        question: String,
        professor_address: address,
        professor_k_hash: vector<u8>,
        professor_kP_x: vector<u8>,
        professor_kP_y: vector<u8>,
        //answers: Table<address, Answer>,
    }

    const EInvalidCommitment: u64 = 0;
    const EInvalidUnlock: u64 = 1;
    const EAnotherProfessor: u64 = 2;
    const EStudentNoAnswer: u64 = 3;
    const EProfessorBadMultiplication: u64 = 4;
    const EStudentBadMultiplication: u64 = 5;
    const EAlreadyAnswered: u64 = 6;

    //Deal with timestamps later, when all proofs are working
    //And js client for student, and for professor works right

    public entry fun professor_create_quest(question: vector<u8>, proof:vector<u8>, professor_k_hash: vector<u8>,
        professor_kP_x: vector<u8>, professor_kP_y: vector<u8>, ctx: &mut TxContext)
    {
        let professor_address = tx_context::sender(ctx);
        //professor_addr_serialized with first byte (least significant) flushed to make it fit 253-bit curve base field
        let professor_addr_serialized = address::to_bytes(professor_address);
        let last_byte = vector::borrow_mut(&mut professor_addr_serialized, 31);
        *last_byte = 0;

         debug::print(&professor_addr_serialized);

        //Immediately asserts that professot commitment is valid
        //(He used this hashed k to multiply by private input P and got public kP_x, kP_y)
        let is_valid : bool = commit(proof, professor_k_hash, professor_kP_x, professor_kP_y, professor_addr_serialized);
        assert!(is_valid, EInvalidCommitment);

        //Only then creates a shared object - quest
        //Writes question text, k_hash, kP_x, kP_y
        //Auto write professor address
        let quest = Quest {
            id: object::new(ctx),
            question: string::utf8(question),
            professor_address,
            professor_k_hash,
            professor_kP_x,
            professor_kP_y,
        };
        let tab: Table<address, Answer> = table::new(ctx);
        ofield::add(&mut quest.id, b"answers", tab);
        transfer::share_object(quest)   
    }

    const EInsufficientCollateral: u64  = 7;
    const EStudentInvalidCommitment: u64 = 8;
    const MIST_PER_SUI: u64 = 1_000_000_000;

    struct StudentAnsweredEvent has copy, drop {
        timestamp_answered: u64, //Deal with it later
        student_address: address,
        akP_x: vector<u8>,          
        akP_y: vector<u8>,
        student_aH_x: vector<u8>,
        student_aH_y: vector<u8>,
    }

    public entry fun student_answer_question(shared_quest: &mut Quest, c: coin::Coin<SUI>, proof_commit: vector<u8>,
     student_a_hash: vector<u8>, student_aH_x: vector<u8>, student_aH_y: vector<u8>, 
     proof_unlock: vector<u8>, akP_x: vector<u8>, akP_y: vector<u8>, clock: &Clock, ctx: &TxContext)
    {
        let student_address = tx_context::sender(ctx);
        let Quest {id: _, question: _, professor_address, professor_k_hash: _,
            professor_kP_x, professor_kP_y} = shared_quest;

        let answers = ofield::borrow_mut<vector<u8>, Table<address, Answer>>(&mut shared_quest.id, b"answers");

        //Take 1 SUI for the mint anyway
        //Send it to professor address, retrieved for Quest object
        //!!!Enable mimimal collateral during production!!!
        //Just remove "/ 10_000_000" to do it
        
        assert!(coin::value(&c) > MIST_PER_SUI / 10_000_000, EInsufficientCollateral);
        transfer::public_transfer(c, *professor_address);

        //Check that I did not answer already i.e Answers map does not have caller address key
        let has_place = !table::contains(answers, student_address);
        //Enable in production, disabled just to quickly test event subscription
        assert!(has_place, EStudentNoAnswer);

        //student_addr_serialized with first byte (least significant) flushed to make it fit 253-bit curve base field
        let student_addr_serialized = address::to_bytes(student_address);
        let last_byte = vector::borrow_mut(&mut student_addr_serialized, 31);
        *last_byte = 0;

        debug::print(&student_addr_serialized);

        //Verify commitment, indeed multiplied preimage of hash by some secret point to get aH_x, aH_y
        let is_valid_commitment = commit(proof_commit, student_a_hash, student_aH_x, student_aH_y, student_addr_serialized);
        assert!(is_valid_commitment, EStudentInvalidCommitment);

        //Verify that public professors kP_x, kP_y was indeed multiplied by some secret a, matching student's public commitment hash_a
        let is_valid_multiplication = unlock(proof_unlock, akP_x, akP_y, 
        student_addr_serialized, student_a_hash, *professor_kP_x, *professor_kP_y);
        assert!(is_valid_multiplication, EStudentBadMultiplication);

        //TODO: Add timestamp here later
        let timestamp_answered: u64 = clock::timestamp_ms(clock);
        
        //Write this commitment to answer
        //Write this multiplication result to answer
        let answer = Answer {
            student_a_hash, 
            student_aH_x,   
            student_aH_y,   
            timestamp_answered, //Deal with it later
            student_address,
            akP_x,          
            akP_y,
        };

        if (has_place) table::add(answers, student_address, answer);
        event::emit(StudentAnsweredEvent{
            timestamp_answered, //Deal with it later
            student_address,
            akP_x,          
            akP_y,
            student_aH_x,
            student_aH_y,
        })
        //Add me to the answer Map
       

        //(Insight) when the price is not enough to reduce bots
        //Can be easily limited to one try per address
        //Or completely unique one-time questions can be made
        //Or different scheme with frozen collateral can be made
    }

    public entry fun professor_score_answer(shared_quest: &mut Quest, student: address, 
    proof:vector<u8>, professor_out_kaH_x: vector<u8>, professor_out_kaH_y: vector<u8>, ctx: &mut TxContext)
    {
        let _professor_address = tx_context::sender(ctx);
        let Quest {id: _, question: _, professor_address, professor_k_hash,
            professor_kP_x: _, professor_kP_y: _, } = shared_quest;
        let answers = ofield::borrow_mut<vector<u8>, Table<address, Answer>>(&mut shared_quest.id, b"answers");

        //Assert that this question belongs to this professor
        assert!(_professor_address == *professor_address, EAnotherProfessor);

        //professor_addr_serialized with first byte (least significant) flushed to make it fit 253-bit curve base field
        let professor_addr_serialized = address::to_bytes(_professor_address);
        let last_byte = vector::borrow_mut(&mut professor_addr_serialized, 31);
        *last_byte = 0;

        //Assert that this student answered indeed
        assert!(table::contains(answers, student), EStudentNoAnswer);

        //Extract his answer
        let student_answer = table::borrow(answers, student);

        let student_aH_x = student_answer.student_aH_x;
        let student_aH_y = student_answer.student_aH_y;
        
        //Do verified multiplication of student aH by k
        let multiplied = unlock(proof, professor_out_kaH_x, professor_out_kaH_y, 
        professor_addr_serialized, *professor_k_hash, student_aH_x, student_aH_y);

        //Assert it was verified groth16 proven
        assert!(multiplied, EProfessorBadMultiplication);

        //If verified professor_final point matches student_final_point
        let right_answer: bool = (professor_out_kaH_x == student_answer.akP_x) && (professor_out_kaH_y == student_answer.akP_y);
        if(right_answer){
            //Mint NFT to the student
            let nft = RewardNFT {
                id: object::new(ctx),
                name : string::utf8(b"zkPrize"),
                description: string::utf8(b"Unleash your brilliance silently and seize the zkPrize - Your winning answers, a mystery to all but winners!"),
                url: url::new_unsafe_from_bytes(b"https://ipfs.io/ipfs/bafkreieo6hprbh3pjghihriasgjrg3fw6j2urmy6ti2k276qrl4k3uax2u"),
            };
            transfer::transfer(nft, student_answer.student_address);
        } else{
            //Otherwise just do nothing (send the wrong answer NFT, any response is better than no)
            let nft = WrongAnswerNFT {
                id: object::new(ctx),
            };
            transfer::transfer(nft, student_answer.student_address);
        };
        
        //Pop the answer from answers table anyway
        table::remove(answers, student);       
    }

    //This is a very important function. If the professor does not respond, mint NFT, even if the answer was wrong.
    public entry fun student_get_timeout_reward(shared_quest: &mut Quest, clock: &Clock, ctx: &mut TxContext)
    {
        //Read current timestamp
        let timestamp_current: u64 = clock::timestamp_ms(clock);

        //Get answers field for this quest
        let answers = ofield::borrow_mut<vector<u8>, Table<address, Answer>>(&mut shared_quest.id, b"answers");

        //Assert that this student answered indeed
        let student_address = tx_context::sender(ctx);
        assert!(table::contains(answers, student_address), EStudentNoAnswer);
        
        //Lookup by caller address answer in shared_quest
        let answer = table::borrow_mut(answers, student_address);

        //Retrieve its timestamp
        let timestamp_answered = answer.timestamp_answered;

        //If professor (oracle) did not check the answer in 2 minutes,
        //Pop answer 
        //Reward the caller with NFT
        if (timestamp_current - timestamp_answered > 2*60*1000)
        {
            table::remove(answers, student_address);
            let nft = RewardNFT {
                id: object::new(ctx),
                name : string::utf8(b"zkPrize"),
                description: string::utf8(b"Unleash your brilliance silently and seize the zkPrize - Your winning answers, a mystery to all but winners!"),
                url: url::new_unsafe_from_bytes(b"https://ipfs.io/ipfs/bafkreieo6hprbh3pjghihriasgjrg3fw6j2urmy6ti2k276qrl4k3uax2u"),
            };
            transfer::transfer(nft, student_address);
        }
    }

    fun verify(proof: vector<u8>, 
            vk_serialized: vector<u8>, public_inputs_serialized: vector<u8>): bool {
        let proof_serialized = hex::decode(proof);
        let curve: Curve = bn254();

        let pvk = prepare_verifying_key(&curve, &vk_serialized);    
        debug::print(&pvk);
        let public_inputs =  public_proof_inputs_from_bytes(public_inputs_serialized);
        let proof_points =  proof_points_from_bytes(proof_serialized);
        verify_groth16_proof(&curve, &pvk, &public_inputs, &proof_points)
    }

    fun commit(proof: vector<u8>, public_out_hash_a: vector<u8>, public_out_aP_x: vector<u8>, 
    public_out_aP_y: vector<u8>, public_in_address: vector<u8>): bool {
        let vk_serialized = x"e2f26dbea299f5223b646cb1fb33eadb059d9407559d7441dfd902e3a79a4d2dabb73dc17fbc13021e2471e0c08bd67d8401f52b73d6d07483794cad4778180e0c06f33bbc4c79a9cadef253a68084d382f17788f885c9afd176f7cb2f036789edf692d95cbdde46ddda5ef7d422436779445c5e66006a42761e1f12efde0018c212f3aeb785e49712e7a9353349aaf1255dfb31b7bf60723a480d9293938e19f1555ee802f49f17c1ded7f8e0a35efd4a7caa5c66b14c5de3bc15e7ac579e02350ae505a137c6dd2a84365a88f2771ab96e4e33c0fdaf5b58ca9cf8528045870500000000000000d05232298846333af5b9c786e300fb364e8f91277dfbd9113761976ef811bd8ae05f5921e1ea4e7a81d8e1217b553562139326591186de5ad755c02ca9519e2a2c8cd74dd2ca1759a54bcfd8d6bb03fcc2fc185ea98112e22fd667275112c7202c27f5c74e447fb310add441802dfa1d53bc87297703e7a90d0438166a2ab6a87b2099a5ca41e6c4c88a00eee53d4bd51c95d13cb8d03d19fa68352e59e9d997";
        
        let public_inputs_serialized: vector<u8> = x"";
        append(&mut public_inputs_serialized, hex::decode(public_out_hash_a));
        append(&mut public_inputs_serialized, hex::decode(public_out_aP_x));
        append(&mut public_inputs_serialized, hex::decode(public_out_aP_y));
        append(&mut public_inputs_serialized, public_in_address);

        debug::print(&public_inputs_serialized);

        let verification_result: bool = verify(proof, vk_serialized, public_inputs_serialized);
        debug::print(&verification_result);
        verification_result
    }

    fun unlock(proof: vector<u8>, public_out_kaH_x: vector<u8>, public_out_kaH_y: vector<u8>, 
    public_in_address: vector<u8>, public_in_hash_k: vector<u8>, public_in_aH_x: vector<u8>, public_in_aH_y: vector<u8>, ): bool {
        let vk_serialized = x"e2f26dbea299f5223b646cb1fb33eadb059d9407559d7441dfd902e3a79a4d2dabb73dc17fbc13021e2471e0c08bd67d8401f52b73d6d07483794cad4778180e0c06f33bbc4c79a9cadef253a68084d382f17788f885c9afd176f7cb2f036789edf692d95cbdde46ddda5ef7d422436779445c5e66006a42761e1f12efde0018c212f3aeb785e49712e7a9353349aaf1255dfb31b7bf60723a480d9293938e19887208fad3f8550e15bf3215798913226934b2d643d5a5f9c34a048aa168172467d50cca4f282065b87d49e7bc3e06b50b3675c66a1c2db2fedd8cbeed76ae2b0700000000000000d05232298846333af5b9c786e300fb364e8f91277dfbd9113761976ef811bd8a87f7c971b71d490782ad5a062ba629c632d23a8c32ccccbd6f90eef0706f4dae0de6bf1b29e90ec277a567aa9582c21e84322e41eb92789b0bec360a94061887494fd99769977a167bced33324f2e2fd654f141dc77844d8375e2d2d6bb55890c863813be5a227e8cc56108364ec7b07228479a299c26da09771ccb3b31a4a074616f0b4ea057686c6fd2d5bffbd4165a352e61744f2b27a971952ace6a9881061021a3b9efae96006b4e0334b7c0a437e941ebf91de9981acba5608b3825a08";
        
        let public_inputs_serialized: vector<u8> = x"";
        append(&mut public_inputs_serialized, hex::decode(public_out_kaH_x));
        append(&mut public_inputs_serialized, hex::decode(public_out_kaH_y));
        append(&mut public_inputs_serialized, public_in_address);
        append(&mut public_inputs_serialized, hex::decode(public_in_hash_k));
        append(&mut public_inputs_serialized, hex::decode(public_in_aH_x));
        append(&mut public_inputs_serialized, hex::decode(public_in_aH_y));
    
        let verification_result: bool = verify(proof, vk_serialized, public_inputs_serialized);
        verification_result
    }

    struct VERIFIER has drop {}
    fun init(otw: VERIFIER, ctx: &mut TxContext) {
       let keys = vector[
            string::utf8(b"name"),
            //utf8(b"link"),
            string::utf8(b"image_url"),
            string::utf8(b"description"),
            //utf8(b"project_url"),
            //utf8(b"creator"),
        ];

        let values = vector[
            // For `name` we can use the `Hero.name` property
            string::utf8(b"{name}"),
            // For `link` we can build a URL using an `id` property
            //utf8(b"https://sui-heroes.io/hero/{id}"),
            // For `img_url` we use an IPFS template.
            string::utf8(b"{url}"),
            // Description is static for all `Hero` objects.
            string::utf8(b"{description}"),
            // Project URL is usually static
            //utf8(b"https://sui-heroes.io"),
            // Creator field can be any
            //utf8(b"Unknown Sui Fan")
        ];

        // Claim the `Publisher` for the package!
        let publisher = package::claim(otw, ctx);

        // Get a new `Display` object for the `Hero` type.
        let display = display::new_with_fields<RewardNFT>(
            &publisher, keys, values, ctx
        );

        // Commit first version of `Display` to apply changes.
        display::update_version(&mut display);

        transfer::public_transfer(publisher, tx_context::sender(ctx));
        transfer::public_transfer(display, tx_context::sender(ctx));
    }
}

