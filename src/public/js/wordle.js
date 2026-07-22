const readline = require('readline');

let data = {
    "words": ["ATIRE", "BIRCH", "CATER", "DIRGE"]
};

// Select random word from data
selectedWord = data.words[Math.floor(Math.random() * data.words.length)];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function countOccurrences(str, char) {
  return [...str].reduce((count, currentChar) =>
    currentChar === char ? count + 1 : count, 0);
}

function wordleGuess(guess, answer) {
    let output = ["X", "X", "X", "X", "X"];

    for (let i = 0; i < 5; i++) {

        let showYellow = true;
        let currentLetterCount = countOccurrences(answer, guess[i]);

        for (let j = 0; j < 5; j++) {
            if (answer[j] == guess[i]) {
                currentLetterCount--
                output[j] == "G";
                console.log(output[j])
            }
        }
    }

    console.log(output);

}

console.log(selectedWord);
rl.question('Enter Guess: ', (input) => {
    wordleGuess(input, selectedWord);
    rl.close();
});