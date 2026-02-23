class FlashcardApp {
    constructor() {
        this.languages = {};
        this.currentMode = null;
        this.currentLanguage = null;
        this.currentCards = [];
        this.currentIndex = 0;
        this.showingBack = false;
        this.quizScore = 0;
        this.quizAnswered = 0;
    }

    init() {
        this.loadLocalStorage();
        this.updateLanguageGrid();
    }

    loadLocalStorage() {
        const stored = localStorage.getItem('languageData');
        if (stored) {
            this.languages = JSON.parse(stored);
        }
    }

    saveToLocalStorage() {
        localStorage.setItem('languageData', JSON.stringify(this.languages));
    }

    parseFile(filename, content) {
        const lines = content.split('\n').filter(line => line.trim());
        const cards = [];

        for (const line of lines) {
            const parts = line.split('|').map(part => part.trim());
            if (parts.length >= 2) {
                cards.push({
                    front: parts[0],
                    back: parts[1],
                    notes: parts[2] || ''
                });
            }
        }

        return cards;
    }

    async loadFromUrl(url, languageName) {
        try {
            // Try direct fetch first
            let response;
            try {
                response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } catch (fetchError) {
                // If direct fetch fails (CORS or insecure context), try with CORS proxy
                console.log('Direct fetch failed, trying CORS proxy...');
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
                response = await fetch(proxyUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }

            const content = await response.text();
            const cards = this.parseFile(languageName, content);

            if (cards.length > 0) {
                this.languages[languageName] = cards;
                this.saveToLocalStorage();
                return { success: true, count: cards.length };
            } else {
                throw new Error('No valid vocabulary entries found in the file');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    updateLanguageGrid() {
        const grid = document.getElementById('languageGrid');
        grid.innerHTML = '';

        for (const [lang, cards] of Object.entries(this.languages)) {
            const btn = document.createElement('div');
            btn.className = 'language-btn';
            btn.innerHTML = `
                <h3>${lang}</h3>
                <p>${cards.length} cards</p>
            `;
            btn.onclick = () => this.startSession(lang);
            grid.appendChild(btn);
        }
    }

    startSession(language) {
        this.currentLanguage = language;
        this.currentCards = [...this.languages[language]];
        this.shuffleArray(this.currentCards);
        this.currentIndex = 0;
        this.showingBack = false;

        if (this.currentMode === 'quiz') {
            this.quizScore = 0;
            this.quizAnswered = 0;
            this.showQuizCard();
        } else {
            this.showFlashcard();
        }
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    showFlashcard() {
        document.body.innerHTML = `
            <div class="container">
                <div class="session-header">
                    <button class="back-btn" onclick="app.showLanguages('${this.currentMode}')">← Back</button>
                    <h2>${this.currentLanguage} - Flashcards</h2>
                    <p>Card ${this.currentIndex + 1} of ${this.currentCards.length}</p>
                </div>

                <div class="flashcard" onclick="app.flipCard()">
                    <div class="card-content">
                        <div class="card-text" id="cardText">${this.currentCards[this.currentIndex].front}</div>
                        ${this.currentCards[this.currentIndex].notes ?
                            `<div class="card-notes" id="cardNotes" style="display: none;">${this.currentCards[this.currentIndex].notes}</div>` :
                            ''}
                    </div>
                </div>

                <div class="controls">
                    <button onclick="app.previousCard()" ${this.currentIndex === 0 ? 'disabled' : ''}>← Previous</button>
                    <button onclick="app.flipCard()" class="flip-btn">Flip Card</button>
                    <button onclick="app.nextCard()" ${this.currentIndex === this.currentCards.length - 1 ? 'disabled' : ''}>Next →</button>
                </div>

                <div class="shuffle-btn">
                    <button onclick="app.shuffleCards()">🔀 Shuffle</button>
                </div>
            </div>
        `;
        this.addFlashcardStyles();
    }

    showQuizCard() {
        const card = this.currentCards[this.currentIndex];
        document.body.innerHTML = `
            <div class="container">
                <div class="session-header">
                    <button class="back-btn" onclick="app.showLanguages('${this.currentMode}')">← Back</button>
                    <h2>${this.currentLanguage} - Quiz</h2>
                    <p>Question ${this.currentIndex + 1} of ${this.currentCards.length}</p>
                    <p>Score: ${this.quizScore}/${this.quizAnswered}</p>
                </div>

                <div class="quiz-card">
                    <div class="question">
                        <h3>Translate:</h3>
                        <div class="question-text">${card.front}</div>
                        ${card.notes ? `<div class="question-notes">${card.notes}</div>` : ''}
                    </div>

                    <div class="answer-section">
                        <input type="text" id="userAnswer" placeholder="Enter your answer..."
                               onkeypress="if(event.key==='Enter') app.checkAnswer()">
                        <button onclick="app.checkAnswer()">Check Answer</button>
                    </div>

                    <div id="result" class="result"></div>
                </div>

                <div class="quiz-controls">
                    <button onclick="app.skipQuestion()">Skip</button>
                    <button id="nextBtn" onclick="app.nextQuizCard()" style="display: none;">Next →</button>
                </div>
            </div>
        `;
        this.addQuizStyles();
        document.getElementById('userAnswer').focus();
    }

    flipCard() {
        const cardText = document.getElementById('cardText');
        const cardNotes = document.getElementById('cardNotes');

        if (!this.showingBack) {
            cardText.textContent = this.currentCards[this.currentIndex].back;
            if (cardNotes) cardNotes.style.display = 'block';
            this.showingBack = true;
        } else {
            cardText.textContent = this.currentCards[this.currentIndex].front;
            if (cardNotes) cardNotes.style.display = 'none';
            this.showingBack = false;
        }
    }

    nextCard() {
        if (this.currentIndex < this.currentCards.length - 1) {
            this.currentIndex++;
            this.showingBack = false;
            this.showFlashcard();
        }
    }

    previousCard() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.showingBack = false;
            this.showFlashcard();
        }
    }

    shuffleCards() {
        this.shuffleArray(this.currentCards);
        this.currentIndex = 0;
        this.showingBack = false;
        this.showFlashcard();
    }

    checkAnswer() {
        const userAnswer = document.getElementById('userAnswer').value.trim().toLowerCase();
        const correctAnswer = this.currentCards[this.currentIndex].back.toLowerCase();
        const result = document.getElementById('result');
        const nextBtn = document.getElementById('nextBtn');

        this.quizAnswered++;

        if (userAnswer === correctAnswer || this.isCloseMatch(userAnswer, correctAnswer)) {
            this.quizScore++;
            result.innerHTML = `
                <div class="correct">
                    ✅ Correct!
                    <div class="answer-display">${this.currentCards[this.currentIndex].back}</div>
                </div>
            `;
        } else {
            result.innerHTML = `
                <div class="incorrect">
                    ❌ Incorrect. The correct answer is:
                    <div class="answer-display">${this.currentCards[this.currentIndex].back}</div>
                </div>
            `;
        }

        document.getElementById('userAnswer').disabled = true;
        nextBtn.style.display = 'inline-block';
    }

    isCloseMatch(answer, correct) {
        return this.levenshteinDistance(answer, correct) <= Math.floor(correct.length * 0.2);
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[str2.length][str1.length];
    }

    skipQuestion() {
        this.quizAnswered++;
        const result = document.getElementById('result');
        result.innerHTML = `
            <div class="skipped">
                ⏭️ Skipped. The answer was:
                <div class="answer-display">${this.currentCards[this.currentIndex].back}</div>
            </div>
        `;
        document.getElementById('userAnswer').disabled = true;
        document.getElementById('nextBtn').style.display = 'inline-block';
    }

    nextQuizCard() {
        if (this.currentIndex < this.currentCards.length - 1) {
            this.currentIndex++;
            this.showQuizCard();
        } else {
            this.showQuizResults();
        }
    }

    showQuizResults() {
        const percentage = Math.round((this.quizScore / this.quizAnswered) * 100);
        document.body.innerHTML = `
            <div class="container">
                <div class="quiz-results">
                    <h2>Quiz Complete!</h2>
                    <div class="score-display">
                        <div class="score">${this.quizScore}/${this.quizAnswered}</div>
                        <div class="percentage">${percentage}%</div>
                    </div>
                    <div class="controls">
                        <button onclick="app.startSession('${this.currentLanguage}')" class="mode-btn">Try Again</button>
                        <button onclick="app.showLanguages('${this.currentMode}')" class="back-btn">Back to Languages</button>
                        <button onclick="app.showHome()" class="back-btn">Home</button>
                    </div>
                </div>
            </div>
        `;
        this.addResultStyles();
    }

    addFlashcardStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .session-header {
                text-align: center;
                margin-bottom: 30px;
            }

            .flashcard {
                background: white;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                padding: 40px;
                margin: 30px 0;
                min-height: 300px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: transform 0.2s;
            }

            .flashcard:hover {
                transform: translateY(-5px);
            }

            .card-content {
                text-align: center;
                width: 100%;
            }

            .card-text {
                font-size: 2em;
                font-weight: bold;
                margin-bottom: 20px;
                color: #333;
            }

            .card-notes {
                font-size: 1em;
                color: #666;
                font-style: italic;
            }

            .controls {
                display: flex;
                justify-content: space-between;
                gap: 10px;
                margin-top: 20px;
            }

            .controls button {
                flex: 1;
                padding: 15px;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                font-size: 1em;
            }

            .flip-btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }

            .shuffle-btn {
                text-align: center;
                margin-top: 20px;
            }
        `;
        document.head.appendChild(style);
    }

    addQuizStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .quiz-card {
                background: white;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                padding: 30px;
                margin: 20px 0;
            }

            .question {
                text-align: center;
                margin-bottom: 30px;
            }

            .question-text {
                font-size: 2em;
                font-weight: bold;
                margin: 20px 0;
                color: #333;
            }

            .question-notes {
                color: #666;
                font-style: italic;
            }

            .answer-section {
                text-align: center;
                margin: 20px 0;
            }

            .answer-section input {
                width: 70%;
                padding: 15px;
                font-size: 1.2em;
                border: 2px solid #ddd;
                border-radius: 10px;
                margin-right: 10px;
            }

            .answer-section button {
                padding: 15px 30px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                font-size: 1.1em;
            }

            .result {
                margin: 20px 0;
                padding: 15px;
                border-radius: 10px;
                text-align: center;
            }

            .correct {
                background: #d4edda;
                color: #155724;
            }

            .incorrect {
                background: #f8d7da;
                color: #721c24;
            }

            .skipped {
                background: #fff3cd;
                color: #856404;
            }

            .answer-display {
                font-weight: bold;
                font-size: 1.2em;
                margin-top: 10px;
            }

            .quiz-controls {
                text-align: center;
                margin-top: 20px;
            }

            .quiz-controls button {
                margin: 0 10px;
                padding: 10px 20px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
    }

    addResultStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .quiz-results {
                text-align: center;
            }

            .score-display {
                margin: 30px 0;
            }

            .score {
                font-size: 3em;
                font-weight: bold;
                color: #333;
            }

            .percentage {
                font-size: 2em;
                color: #667eea;
                margin-top: 10px;
            }
        `;
        document.head.appendChild(style);
    }
}

const app = new FlashcardApp();

function showHome() {
    location.reload();
}

function showLanguages(mode) {
    app.currentMode = mode;
    document.getElementById('homeScreen').style.display = 'none';
    document.getElementById('languageScreen').style.display = 'block';
    document.getElementById('modeTitle').textContent =
        mode === 'flashcard' ? 'Select Language for Flashcards' : 'Select Language for Quiz';
}

function loadFiles() {
    const fileInput = document.getElementById('fileInput');
    const files = fileInput.files;

    if (files.length === 0) {
        alert('Please select some files first!');
        return;
    }

    let filesProcessed = 0;

    for (const file of files) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            const languageName = file.name.replace('.txt', '').replace('.csv', '');
            const cards = app.parseFile(file.name, content);

            if (cards.length > 0) {
                app.languages[languageName] = cards;
                app.saveToLocalStorage();
            }

            filesProcessed++;
            if (filesProcessed === files.length) {
                app.updateLanguageGrid();
                alert(`Loaded ${Object.keys(app.languages).length} language(s) successfully!`);
            }
        };
        reader.readAsText(file);
    }
}

async function loadFromUrl() {
    const urlInput = document.getElementById('urlInput');
    const languageNameInput = document.getElementById('languageNameInput');

    const url = urlInput.value.trim();
    const languageName = languageNameInput.value.trim();

    if (!url) {
        alert('Please enter a URL!');
        return;
    }

    if (!languageName) {
        alert('Please enter a language name!');
        return;
    }

    // Show loading state
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = 'Loading...';
    button.disabled = true;

    try {
        const result = await app.loadFromUrl(url, languageName);

        if (result.success) {
            app.updateLanguageGrid();
            alert(`Successfully loaded ${result.count} vocabulary entries for ${languageName}!`);
            urlInput.value = '';
            languageNameInput.value = '';
        } else {
            alert(`Failed to load vocabulary: ${result.error}`);
        }
    } catch (error) {
        alert(`Error loading from URL: ${error.message}`);
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

window.onload = function() {
    app.init();
};