# 💎 Promise 

Safely blockchainify any puzzle game with zero-knowledge proofs.
Async hash games were never possible onchain. Behold. First time in this world. Exclusively on Sui.
We solved this challenge with a new zk primitive [unlock.circom](unlock.circom). Learn more about this [circom circuit here](zk-circuit.md).

Here is a [technical video](https://youtu.be/3qw3JumActw) demo. 

For more fascination try it yourself.
Try [our simplified technical demo](https://promise-zk.netlify.app/).
Please use mainnet only. 

We have a full product based on this zk tech. We want to have it featured in the next Bullshark Quest.  
See [our product - game protected by Promise](https://www.youtube.com/watch?v=DhhGvzsPukc). 

## Original technology

The protocol builds upon a solid zero-knowledge foundation, but adds an unexpected twist. 
A new multi-party computation algorithm was researched for Promise project.
More cryptography and technical details are in the second half of this readme.

## Community contribution
A circom circuit, server/client api, and a smart contract on Sui.
This suite of tools allows anyone to run their puzzle game on-chain.

Promise is a mathematical protocol to solve cheating in games once and for all. Plus a multidtude of other benefits.
Read more to understand.

## A mathematical protocol 

There are games to tell stories. There are games to solve mysteries. If there is only one way to solve a level - only one answer - then Promise works.

Any such game old or new can, actually, be run on-chain. 
It can be placing mirrors to guide the laser through the labirynth. It can be finding one concept which unites four pictures. It can be guessing which brand is on the logo. We present a general solution to rule them all. 

## A must
Why should we blockchainify games at all? What does it even mean?

Something never possible before blockchain and before zero-knowledge proofs happens. Let's say a game level has just one correct solution.
Promise is an algorithm to verify the correctness of the level solution. Promise uses zero-knowledge proofs to comply with the rules. It safeguards the interaction between game server and player by being an on-chain middleman. 

## Why different

There are lots of guessing games based on hash.
On Sui there is a great one. Guess where the ball is on http://winx.io
But the main disadvatage - to resolve game means to reveal pre-image.

It leads to synchronous games. People wait. And wait a lot. For example in winx, they wait a week before the prize!

Promise is completely asynchronous. It is like John Carmack's Quake World to Quake. If you know what I mean ;) 
Each wrong or right attempt is resolved in seconds. Our tech is completely async. 

Let's see what else Promise brings to the world of gaming. 

<!-- **Auto payout on win**
> Before chains:
>  Games often just change the rules in the middle. Out of nowhere, they could drastically cut the payout. There's a [whole list of P2E scams](https://cointelegraph.com/news/scams-in-gamefi-how-to-identify-toxic-nft-gaming-projects) that could be easily avoided by using Promise. 
>
> After:
> There is an algorithmic commitment. Promise escrows the money. There is no other way. Users are always auto-payed for the right answer. If the project is protected by Promise, it can be trusted.

That's why with Promise you get what you are Promised. It not only offers protection for the user. 
Unlike many client-side P2E games, Promise protected games are immune to all sorts of client-side memory hacks. -->

<!-- **Auto money back on non-delivery** 
> Before chains:
> There are a lot of complaints on Google Play. Paid features are often not working.
>
> After:
> Promise auto-returns escrowed money, if the level was not delivered to the user. There is no other way around. 
The money is returned in two minutes. -->

 **Privacy: Replayable games**
> Before zero-knowledge:
> To verify on-chain, the server had to open a commitment hash. The public announcment of the answer rendered game no longer playable. Other people could not play it. They already knew the answer, so it would be pointless. 
>
> After:
> On one side, Promise is transparent. The protocol is done on a public blockchain. On the other side, due to our new zero-knowledge algorithm, there is no need to reveal any private info to verify the answer. Other people can still play it. Be it ten or ten thousand times. Rules are known in advance. With Promise games are ultimately async, replayable and transparent!

**Privacy: Payout is instant**
> Before on-chain zero-knowledge:
> There are no guarantees. The server is not obliged to pay at all. Remember those games with weekly payouts?
> Even worse. Verification happens "behind the closed doors". So, there are zero guarantees for the parties. Both might break the rules. As there are no fixed rules at all.
>
> After:
> The smart contract on-chain safeguards the process. Amount and time are fixed in advance. 
> This transparency gives rock solid guarantees. All rules are fixed. Rewards are instant.

<!-- **Privacy: Nobody steals from the company**
> Before on-chain zero-knowledge:
Private gaming -->

**Privacy: Encourage creativity**
> Before on-chain zero-knowledge:
> Imagine an exam or a creativity game. How does being wrong in public feel? This automatically diminishes creativity. Only in a safe space new ideas emerge.
> 
> After:
> Imagine that one could always take words back. And right the wrongs. Without anyone ever noticing. This is the case with Promise. There are no wrong tries. Your answer is encrypted in a very particular way. Even the game company does not know what you answered. They only know 1-bit. Either you matched the right answer or not. Nothing more. This sense liberates you and encourages creative ideas.

## Concluding remarks
Warning! Starting from the next section are very technical details. One might even want to say nerdy. It is ok if you are not into algorithms. If you feel uncomfortable there is nothing wrong in skipping this part. It is going to explore the rationale and the code behind.

Thanks for be willing to know about the benefits of on-chain zero-knowldge gaming with Promise. And thanks for reading the text. Here is a small conclusion then:

I hope that this work sparks more conversation about verifiable games. And their common bulding blocks. Promise is such a foundational bulding block. It acts as an on-chain middle man. It matches user and game server answers with our new zero-knowledge technology. It uses a collateral scheme to deincentivize any fraud. As a result: there is no more cheating, there are always guaranteed rewards, the rewards are instant, at the same time the games are private for both sides. We hope that you benefit by using it in your projects. Together we redefine the gaming. And we Promise. The future of games is here!

## The algorithm shortly

So, the latter are the details for the 🦄 nerds like us:

A point on an elliptic curve denotes the right answer. It encodes an arbitrary string. For example, in laser labyrinth it would encode the correct path. In logo guessing game it would encode the brand name. In our quiz example it would be a trivia answer.

Here I implemented simple [try-and-increment encoding of a string answer](boneh-encode/hash_to_curve.js). If a human and captcha server, using groth16, prove
that they did a Diffie-Hellman key exchange, and they arrived at the same point, then the answer is right. 

Those two circuits: the first one for initial commitment to the key, and the second for proven multiplication are
in: [commit.circom](commit.circom) and [unlock.circom](unlock.circom)

## When it works 

The security proof relies on DDH - Decisional Diffie-Hellman assumption. It holds for elliptic curves with high embedding degree where pairings are not efficiently computable. 

When the adversary sees more tries. Breaking the system this way tranforms into finding multi-linear pairings. And there are [some additional reasons](https://crypto.stanford.edu/~dabo/papers/mlinear.pdf) why it seems difficult.  

## Why non-trivial

The difficulty was that it involes two parties, say, student and professor. So it is a multi-party computation protocol. The professor holds a secret - the true answer. The hardest thing, this answer belongs to a very small set. Might be just three options for a multiple choice test.

So, trusting the true answer, even hashed to a smart contract is insecure. (Salting the hash is not an option.
It works, but anyway means that the salt is a secret stored by another party) 

Even a more general statement. If there is enough information to verify the answer in the smart-contract. And we want verification to be quick. And this chain does not support secret sharing. Then such smart-contract might be dry-run. The perpetrator could just simulate calling the contract and instantly guess which option from three was correct. That's why we anyway need at least second party to hold the secret safely.

## Why zkNARK

The use-case of NARK here is to prove that each party follows the multi-party computataion protocol as it's written. The groth16 verifier is implemented in [the smart contract, please see it.](sui-verifier/sources/dev_verifier.move) The contract acts as middleman. It de-incentivizes both sides for not providing the proof in time. And makes cheating meaningless and costly.

The cost of a try can be [tweaked here](sui-verifier/sources/dev_verifier.move#L124). 
[Use deploy.js](client-scripts/deploy.js) if you want to ship your own version.
The contract can handle as many different questions at the same time as one neeeds.

## A bit more details on the algorithm

The idea is to encode the answers by hashing to a point on the elliptic curve, and prove that both parties obeyed Diffie-Hellman exchange. 
If they could arrive at the same point it means that they started from the same point, if they could not then answers were different.

To ellaborate, P is a to-curve hash of my answer. And k is my random key. And a is professor's random key. I commit to kP and professor commited to aP'. We do proven by a circom circuit Diffie-Hellman. We get akP and akP'. Look more into [professor.js to see implementation](client-scripts/professor.js) of this oracle logic.

Then if they are equal we had same answers. Seems like no information leaked under Decisional Diffie-Hellman assumption. Or some sort of a multi-linear generalization, if many past tries are available in public.

## Conclusion

I hope that this work sparks more converstation about verifiable games. And their general - often occuring - bulding blocks. Promise is such a foundational bulding block. It acts as an on-chain middle man. It matches user and game server answers with our new zero-knowledge technology. It uses a collateral scheme to deincentivize any fraud. As a result: there is no more cheating, there are always guaranteed rewards, the rewards are instant, at the same time the games are private for both sides. 

We hope that you benefit by using it in your projects. Together we redefine the gaming. And we Promise. Fully async and onchain. The future of gaming is here!  

