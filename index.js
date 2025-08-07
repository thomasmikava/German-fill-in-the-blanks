const app = {
  // --- DATA ---
  tests,
  currentTestId: null,

  // --- INITIALIZATION ---
  init() {
    this.showTableView();
  },

  // --- VIEW MANAGEMENT ---
  showTableView() {
    document.getElementById("tableView").classList.remove("hidden");
    document.getElementById("testView").classList.add("hidden");
    this.renderTable();
  },

  showTestView(testId, isReview = false) {
    this.currentTestId = testId;
    const test = this.tests.find((t) => t.id === testId);
    if (!test) return;

    document.getElementById("tableView").classList.add("hidden");
    document.getElementById("testView").classList.remove("hidden");

    document.getElementById("testName").innerText = `(${test.id}) ${test.name}`;
    document.getElementById("resultsArea").classList.add("hidden");
    document.getElementById("submitBtn").classList.remove("hidden");
    document.getElementById("resetBtn").classList.add("hidden");
    document.getElementById("submitPartialBtn").classList.add("hidden");

    if (isReview) {
      this.renderReview(test);
    } else {
      this.renderTest(test);
    }
  },

  // --- RENDERING LOGIC ---
  renderTable() {
    const testsList = document.getElementById("testsList");
    testsList.innerHTML = "";
    this.tests.forEach((test) => {
      const result = this.getStoredResult(test.id);
      const isPartial = this.isPartiallyCompleted(test.id);
      const isComplete = this.isFullyCompleted(test.id);

      let score, actionButton;

      if (isComplete) {
        score = `${result.score}/${result.totalBlanks}`;
        actionButton = `<button class="btn-secondary" onclick="app.showTestView(${test.id}, true)">Review</button>`;
      } else if (isPartial) {
        score = "-";
        actionButton = `<button class="btn-primary" onclick="app.showTestView(${test.id})">Resume Test</button>`;
      } else {
        score = "Not taken";
        actionButton = `<button class="btn-primary" onclick="app.showTestView(${test.id})">Start Test</button>`;
      }

      const row = document.createElement("tr");
      row.innerHTML = `
                        <td>${test.id}</td>
                        <td>${test.name}</td>
                        <td>${score}</td>
                        <td>${actionButton}</td>
                    `;
      testsList.appendChild(row);
    });
  },

  renderTest(test) {
    const contentDiv = document.getElementById("testContent");
    contentDiv.innerHTML = "";
    const attempts = this.getStoredAttempts(test.id);
    let inputIndex = 0;

    test.content.items.forEach((item) => {
      if (item.type === "text") {
        contentDiv.appendChild(document.createTextNode(item.value));
      } else if (item.type === "missing") {
        const attemptData = attempts && attempts.answers[inputIndex];

        if (
          attemptData &&
          (attemptData.status === "correct" || attemptData.status === "partial")
        ) {
          // Show as unchangeable text for correct/partial answers
          const span = document.createElement("span");
          span.classList.add(attemptData.status);
          span.style.padding = "4px 6px";
          span.style.margin = "0 4px";
          span.style.borderRadius = "6px";
          span.textContent = attemptData.userInput;
          contentDiv.appendChild(span);
        } else {
          // Show as input (either new or incorrect from previous attempt)
          const input = document.createElement("input");
          input.type = "text";
          input.dataset.index = inputIndex;

          if (attemptData) {
            if (attemptData.status === "incorrect") {
              input.value = attemptData.userInput;
              input.classList.add("incorrect-editable");
            }
          }

          contentDiv.appendChild(input);
        }
        inputIndex++;
      }
    });

    // Show/hide appropriate buttons and add event listeners
    this.updateButtonVisibility();
    document.getElementById("submitBtn").onclick = () => this.submitTest();
    document.getElementById("submitPartialBtn").onclick = () =>
      this.submitPartialTest();

    // Add input event listeners for dynamic button visibility and red styling removal
    const allInputs = document.querySelectorAll("#testContent input");
    allInputs.forEach((input) => {
      input.addEventListener("input", () => {
        input.classList.remove("incorrect-editable");
        this.updateButtonVisibility();
      });
    });
  },

  renderReview(test) {
    const result = this.getStoredResult(test.id);
    if (!result) return;

    this.displayResults(test, result);
  },

  // --- TEST LOGIC ---
  hasNonEmptyInputs() {
    const inputs = document.querySelectorAll("#testContent input");
    return Array.from(inputs).some((input) => input.value.trim() !== "");
  },

  submitPartialTest() {
    const test = this.tests.find((t) => t.id === this.currentTestId);
    const inputs = document.querySelectorAll("#testContent input");
    const missingItems = test.content.items.filter(
      (item) => item.type === "missing"
    );

    // Check if there are any non-empty inputs
    const hasNonEmpty = Array.from(inputs).some(
      (input) => input.value.trim() !== ""
    );
    if (!hasNonEmpty) {
      alert("Please fill in at least one answer before submitting.");
      return;
    }

    const attempts = this.getStoredAttempts(test.id) || {
      answers: new Array(missingItems.length).fill(null),
      scoringEligible: new Array(missingItems.length).fill(true),
    };

    let currentScore = 0;
    let allCorrect = true;

    // Process all missing items, keeping track of input index separately
    let inputIndex = 0;
    missingItems.forEach((item, index) => {
      const existingAttempt = attempts.answers[index];

      // If already correct/partial, count toward score but don't process input
      if (
        existingAttempt &&
        (existingAttempt.status === "correct" ||
          existingAttempt.status === "partial")
      ) {
        if (existingAttempt.status === "correct") {
          currentScore++;
        }
        // Don't increment inputIndex as this is shown as span, not input
        return;
      }

      // Process current input (for new attempts or incorrect previous attempts)
      const input = inputs[inputIndex];
      if (input) {
        const userAnswer = input.value.trim();

        if (userAnswer !== "") {
          let status = "incorrect";
          const previousAttempt = attempts.answers[index];
          const wasPreviouslyIncorrect =
            previousAttempt && previousAttempt.status === "incorrect";

          if (item.officialAnswers.includes(userAnswer)) {
            // If this was previously incorrect, mark as partial (cyan) and don't score
            if (wasPreviouslyIncorrect) {
              status = "partial";
              attempts.scoringEligible[index] = false;
            } else {
              status = "correct";
              // Only count score if this input is still eligible for scoring
              if (attempts.scoringEligible[index]) {
                currentScore++;
              }
            }
          } else if (
            item.additionalAnswers &&
            item.additionalAnswers.includes(userAnswer)
          ) {
            status = "partial";
            // Only count score if this input is still eligible for scoring
            if (attempts.scoringEligible[index]) {
              // Partial answers might count toward score, depending on requirements
            }
          } else {
            // Mark as not eligible for future scoring if incorrect
            attempts.scoringEligible[index] = false;
            allCorrect = false;
          }

          attempts.answers[index] = { userInput: userAnswer, status };
        } else {
          allCorrect = false;
        }
      }
      // Always increment inputIndex for items that should have inputs
      inputIndex++;
    });

    // Check if all answers are now correct/partial
    const isCompleteAndCorrect = attempts.answers.every(
      (answer, index) =>
        answer && (answer.status === "correct" || answer.status === "partial")
    );

    this.storeAttempts(test.id, attempts);

    if (isCompleteAndCorrect) {
      // Convert to full result and complete the test
      const finalResult = {
        answers: attempts.answers,
        score: currentScore,
        totalBlanks: missingItems.length,
        isComplete: true,
      };
      this.storeResult(test.id, finalResult);
      this.displayResults(test, finalResult);
    } else {
      // Re-render the test with updated state
      this.renderTest(test);
      // Show the partial submit button
      document.getElementById("submitPartialBtn").classList.remove("hidden");
    }
  },

  submitTest() {
    const test = this.tests.find((t) => t.id === this.currentTestId);
    const inputs = document.querySelectorAll("#testContent input");
    const spans = document.querySelectorAll(
      "#testContent span.correct, #testContent span.partial"
    );
    const missingItems = test.content.items.filter(
      (item) => item.type === "missing"
    );

    let score = 0;
    const results = {
      answers: [],
      totalBlanks: missingItems.length,
      isComplete: true,
    };

    // Check if we have partial attempts to merge
    const attempts = this.getStoredAttempts(test.id);
    let inputIndex = 0;

    missingItems.forEach((item, index) => {
      let userAnswer = "";
      let status = "incorrect";

      // Check if this was already completed in partial submission
      if (
        attempts &&
        attempts.answers[index] &&
        (attempts.answers[index].status === "correct" ||
          attempts.answers[index].status === "partial")
      ) {
        userAnswer = attempts.answers[index].userInput;
        status = attempts.answers[index].status;
        if (status === "correct") {
          score++;
        }
      } else {
        // Get from input
        const input = inputs[inputIndex];
        userAnswer = input ? input.value : "";

        // Check if this was previously incorrect in attempts
        const wasPreviouslyIncorrect =
          attempts &&
          attempts.answers[index] &&
          attempts.answers[index].status === "incorrect";

        if (item.officialAnswers.includes(userAnswer)) {
          // If this was previously incorrect, mark as partial (cyan) and don't score
          if (wasPreviouslyIncorrect) {
            status = "partial";
          } else {
            status = "correct";
            // Only count score if this input is still eligible for scoring
            if (!attempts || attempts.scoringEligible[index] !== false) {
              score++;
            }
          }
        } else if (
          item.additionalAnswers &&
          item.additionalAnswers.includes(userAnswer)
        ) {
          status = "partial";
          // Only count score if this input is still eligible for scoring (if needed for partial)
          // if (!attempts || attempts.scoringEligible[index] !== false) {
          //   // Partial answers might count toward score, depending on requirements
          // }
        }
        inputIndex++;
      }

      results.answers.push({ userInput: userAnswer, status });
    });

    results.score = score;
    this.storeResult(test.id, results);
    this.displayResults(test, results);
  },

  displayResults(test, result) {
    const contentDiv = document.getElementById("testContent");
    contentDiv.innerHTML = ""; // Clear previous content

    const missingItems = test.content.items.filter(
      (item) => item.type === "missing"
    );
    let resultIndex = 0;

    test.content.items.forEach((item) => {
      if (item.type === "text") {
        contentDiv.appendChild(document.createTextNode(item.value));
      } else if (item.type === "missing") {
        const savedAnswer = result.answers[resultIndex];
        const officialAnswer = item.officialAnswers[0];
        const span = document.createElement("span");

        span.classList.add(savedAnswer.status);
        span.style.padding = "4px 6px";
        span.style.margin = "0 4px";
        span.style.borderRadius = "6px";

        if (savedAnswer.status === "correct") {
          span.textContent = savedAnswer.userInput;
        } else if (savedAnswer.status === "partial") {
          // Check if this was a previously incorrect answer that became correct
          const attempts = this.getStoredAttempts(test.id);
          const wasPreviouslyIncorrect =
            attempts &&
            attempts.answers[resultIndex] &&
            attempts.scoringEligible &&
            attempts.scoringEligible[resultIndex] === false &&
            item.officialAnswers.includes(savedAnswer.userInput);

          if (wasPreviouslyIncorrect) {
            // Just show the correct answer without parentheses for previously incorrect answers
            span.textContent = savedAnswer.userInput;
          } else {
            // Show with official answer for truly partial answers
            span.innerHTML = `${savedAnswer.userInput} <span class="official-answer-text">(${officialAnswer})</span>`;
          }
        } else {
          // incorrect
          const additionalText = item.additionalAnswers
            ? ` [${item.additionalAnswers.join(", ")}]`
            : "";
          span.innerHTML = `<span class="incorrect-answer-text">${
            savedAnswer.userInput || "___"
          }</span> <span class="official-answer-text">${officialAnswer}</span><span class="additional-answers-text">${additionalText}</span>`;
        }

        contentDiv.appendChild(span);
        resultIndex++;
      }
    });

    // Show results area
    const resultsArea = document.getElementById("resultsArea");
    resultsArea.classList.remove("hidden");
    document.getElementById(
      "scoreDisplay"
    ).innerText = `Score: ${result.score} out of ${result.totalBlanks} correct`;
    document.getElementById("fullText").innerText = this.generateFullText(test);

    // Update buttons
    document.getElementById("submitBtn").classList.add("hidden");
    document.getElementById("submitPartialBtn").classList.add("hidden");
    const resetBtn = document.getElementById("resetBtn");
    resetBtn.classList.remove("hidden");
    resetBtn.onclick = () => this.resetTest();
  },

  resetTest() {
    // Clear both attempts and results to fully reset the test
    this.deleteStoredResult(this.currentTestId);
    this.showTestView(this.currentTestId, false);
  },

  generateFullText(test) {
    return test.content.items
      .map((item) => {
        if (item.type === "text") {
          return item.value;
        }
        return item.officialAnswers[0];
      })
      .join("");
  },

  // --- LOCALSTORAGE HELPERS ---
  getStorageKey(testId) {
    return `testResult_${testId}`;
  },

  getAttemptsStorageKey(testId) {
    return `testAttempts_${testId}`;
  },

  storeResult(testId, result) {
    localStorage.setItem(this.getStorageKey(testId), JSON.stringify(result));
  },

  getStoredResult(testId) {
    const data = localStorage.getItem(this.getStorageKey(testId));
    return data ? JSON.parse(data) : null;
  },

  storeAttempts(testId, attempts) {
    localStorage.setItem(
      this.getAttemptsStorageKey(testId),
      JSON.stringify(attempts)
    );
  },

  getStoredAttempts(testId) {
    const data = localStorage.getItem(this.getAttemptsStorageKey(testId));
    return data ? JSON.parse(data) : null;
  },

  deleteStoredResult(testId) {
    localStorage.removeItem(this.getStorageKey(testId));
    localStorage.removeItem(this.getAttemptsStorageKey(testId));
  },

  // Check if test is partially completed
  isPartiallyCompleted(testId) {
    const attempts = this.getStoredAttempts(testId);
    const result = this.getStoredResult(testId);
    // Test is partial if it has attempts but no complete result
    return attempts && (!result || !result.isComplete);
  },

  // Check if test is fully completed
  isFullyCompleted(testId) {
    const result = this.getStoredResult(testId);
    // For backward compatibility, treat old results without isComplete as complete
    return result && result.isComplete !== false;
  },

  updateButtonVisibility() {
    const isPartial = this.isPartiallyCompleted(this.currentTestId);
    const hasNonEmpty = this.hasNonEmptyInputs();
    const submitPartialBtn = document.getElementById("submitPartialBtn");

    // Show partial submit button if test is already partial or if there are non-empty inputs
    submitPartialBtn.classList.toggle("hidden", !isPartial && !hasNonEmpty);
  },
};

// Start the application once the DOM is loaded
document.addEventListener("DOMContentLoaded", () => app.init());
