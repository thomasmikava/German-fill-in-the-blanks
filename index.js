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

    document.getElementById("testName").innerText = test.name;
    document.getElementById("resultsArea").classList.add("hidden");
    document.getElementById("submitBtn").classList.remove("hidden");
    document.getElementById("resetBtn").classList.add("hidden");

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
      const score = result
        ? `${((result.score / result.totalBlanks) * 100).toFixed(0)}%`
        : "Not taken";

      const row = document.createElement("tr");
      row.innerHTML = `
                        <td>${test.id}</td>
                        <td>${test.name}</td>
                        <td>${score}</td>
                        <td>
                            ${
                              result
                                ? `<button class="btn-secondary" onclick="app.showTestView(${test.id}, true)">Review</button>`
                                : `<button class="btn-primary" onclick="app.showTestView(${test.id})">Start Test</button>`
                            }
                        </td>
                    `;
      testsList.appendChild(row);
    });
  },

  renderTest(test) {
    const contentDiv = document.getElementById("testContent");
    contentDiv.innerHTML = "";
    let inputIndex = 0;
    test.content.items.forEach((item) => {
      if (item.type === "text") {
        contentDiv.appendChild(document.createTextNode(item.value));
      } else if (item.type === "missing") {
        const input = document.createElement("input");
        input.type = "text";
        input.dataset.index = inputIndex++;
        contentDiv.appendChild(input);
      }
    });

    document.getElementById("submitBtn").onclick = () => this.submitTest();
  },

  renderReview(test) {
    const result = this.getStoredResult(test.id);
    if (!result) return;

    this.displayResults(test, result);
  },

  // --- TEST LOGIC ---
  submitTest() {
    const test = this.tests.find((t) => t.id === this.currentTestId);
    const inputs = document.querySelectorAll("#testContent input");
    const missingItems = test.content.items.filter(
      (item) => item.type === "missing"
    );

    let score = 0;
    const results = {
      answers: [],
      totalBlanks: missingItems.length,
    };

    missingItems.forEach((item, index) => {
      const input = inputs[index];
      const userAnswer = input.value;
      let status = "incorrect";

      if (item.officialAnswers.includes(userAnswer)) {
        status = "correct";
        score++;
      } else if (
        item.additionalAnswers &&
        item.additionalAnswers.includes(userAnswer)
      ) {
        status = "partial";
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
          span.innerHTML = `${savedAnswer.userInput} <span class="official-answer-text">(${officialAnswer})</span>`;
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
    const resetBtn = document.getElementById("resetBtn");
    resetBtn.classList.remove("hidden");
    resetBtn.onclick = () => this.resetTest();
  },

  resetTest() {
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

  storeResult(testId, result) {
    localStorage.setItem(this.getStorageKey(testId), JSON.stringify(result));
  },

  getStoredResult(testId) {
    const data = localStorage.getItem(this.getStorageKey(testId));
    return data ? JSON.parse(data) : null;
  },

  deleteStoredResult(testId) {
    localStorage.removeItem(this.getStorageKey(testId));
  },
};

// Start the application once the DOM is loaded
document.addEventListener("DOMContentLoaded", () => app.init());
