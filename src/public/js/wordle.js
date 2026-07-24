const readline = require('readline');

let data = {
    "words": ["RIGHT"]
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
  let remaining = {}; // tracks unmatched letters left in answer

  // Pass 1: mark greens, count up remaining letters for everything else
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) {
      output[i] = "G";
    } else {
      remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
  }

  // Pass 2: mark yellows/grays for non-green letters
  for (let i = 0; i < 5; i++) {
    if (output[i] === "G") continue;

    let letter = guess[i];
    if (remaining[letter] > 0) {
      output[i] = "Y";
      remaining[letter]--;
    } else {
      output[i] = "X";
    }
  }

  console.log(output);
  return output;
}

console.log(selectedWord);
rl.question('Enter Guess: ', (input) => {
    wordleGuess(input, selectedWord);
    rl.close();
});