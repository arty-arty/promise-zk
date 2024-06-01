## A circuit synopsis

Here is a short synopsis of the algorithm, just to remind:

For gaming or CAPTCHA - secrets (=answers) are small. E.g. English language words are just 10-bits average. Hash would be instantly bruteforced with a table lookup.
That's why we need the second party to hide the secret. And a smart contract mediator to zk prove match (=answer verification) queries done correctly.

I suggest to hash answers to an elliptic curve. And do Diffie-Hellman.

Let $G$ anf $G'$ be oracle and user answers. Let, $k$, $a$ be their random keys.
Then after we do a correct Diffie-Hellman proven by a circom circuit. We get final points
$kaG$ and $akG'$. If points match then contract unlocks reward. 

<!-- 
We hash oracle true answer and person answer to curve points $G'$ and $G$ respectively. We do a Diffie-Hellman key exchange. -->

<!-- In case of 
The secret 
I want to prove that I know a secret.

To interact with humans, we the inforamtion belongs to a small set of choices. Instead of 256-bit password.
But it's not .  We -->

## Security consideration 1

<!-- This is not a complete and rigorous proof, yet. Though it was my rationale when I came up with this simple system.

I know this might be obvious. I wanted to write it up, -->

Let's say $k$ is oracle's key, $a$ is player's key, $G$ is the right answer. $G'$ some answer by the player.
After one interaction the player knows $M = kG$ and $M' = kG'$. Remember that the possible answer set is small. It's just a CAPTCHA - not so many combinations. Or even a multiple choice question with three choices.

What if we additionaly know that $G = xG'$ for some $x$ from a small known set. Then bruteforce $x$ until $xM' = M$. Then the malicious player would know the true answer  $G = xG'$.
<!-- So, to protect, we must not allow correlation between different encoded answers happen.  -->

That's where try-and-increment hashing saves the day. In random oracle model, $G$ and $G'$ will not be correlated in any way.
And the protocol safe from this kind of attacks. 

## Security consideration 2

Even if the encoded answer points are random. An ability to solve Decisional-Diffie Hellman problem would break the protocol.
Let's say there is a an efficiently computable billinear mapping from this group $G_1$ to some other $G_T$ called $e: G_1 \rightarrow G_T$.
Bruteforce possilbe $G'$ from a small set until $e(kG, aG) = e(G', kaG)$. To protect, I chose a Baby Jubjub group with a high embedding degree, where pairings are computationally inefficient.

When the adversary sees more tries. Breaking the system this way tranforms into finding multi-linear pairings. And there are [some additional reasons](https://crypto.stanford.edu/~dabo/papers/mlinear.pdf) why it seems difficult.  

## A Major Application
CAPTCHA. Imagine a dApp. Most likely you interact with NFTs or tokens. In web3 projects, the majority of non-developers are attracted by this. Imagine an NFT mint. Unfortunately, real people often have almost zero chance to win. 

The more popular the project the more bots. A horde of bots. They steals all available places, long before user has time to click. It [happens a lot](https://cryptoslate.com/the-saudis-hits-number-1-on-opensea-as-bots-claim-free-mint-scammers-attack-discord/). 
Sometimes botters make mistakes and it becomes apparent. Top of the iceberg.

With zkMatch either a regular CAPTCHA answer is encoded or a word puzzle. Each user has to match the answer to mint a token. No one, without passing a CAPTCHA, can trigger the smart contract. Each failed try is paid. Bruteforcing becomes costly and infeasible.