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
        this.audioCache = {};
    }

    // Get VoiceRSS language code
    getVoiceRSSLanguageCode(language) {
        const langMap = {
            'japanese': 'ja-jp',
            'german': 'de-de',
            'spanish': 'es-es',
            'chinese': 'zh-cn',
            'mandarin': 'zh-cn',
            'français': 'fr-fr',
            'french': 'fr-fr',
            'italiano': 'it-it',
            'italian': 'it-it',
            'icelandic': 'is-is',
            'íslenska': 'is-is'
        };

        const baseLang = language.split(' - ')[0].toLowerCase().trim();

        let langCode = langMap[baseLang];
        if (!langCode) {
            for (const [key, value] of Object.entries(langMap)) {
                if (baseLang.includes(key) || key.includes(baseLang)) {
                    langCode = value;
                    break;
                }
            }
        }

        return langCode || 'en-us';
    }

    playPronunciation(text, language) {
        const cleanText = text.split('/')[0].trim();
        const langCode = this.getVoiceRSSLanguageCode(language);
        const apiKey = 'a9d1a2963a804175a694b80d51e4af6f';
        const audioUrl = `https://api.voicerss.org/?key=${apiKey}&hl=${langCode}&src=${encodeURIComponent(cleanText)}&c=MP3&f=44khz_16bit_stereo`;
        const audio = new Audio(audioUrl);
        audio.addEventListener('error', (e) => console.error('VoiceRSS audio error:', e));
        audio.play().catch(err => console.error('VoiceRSS play error:', err));
    }

    init() {
        try { localStorage.removeItem('languageData'); } catch (_) {}
        this._homeHTML = document.body.innerHTML;
        this.updateLanguageGrid();
    }

    _restoreHome() {
        if (this._flashcardKeyHandler) {
            document.removeEventListener('keydown', this._flashcardKeyHandler);
            this._flashcardKeyHandler = null;
        }
        document.body.innerHTML = this._homeHTML;
        this.updateLanguageGrid();
        const githubSelect = document.getElementById('githubLanguageSelect');
        if (githubSelect) githubSelect.addEventListener('change', handleGithubLanguageChange);
        const btn = document.getElementById('themeToggleBtn');
        if (btn) btn.textContent = document.documentElement.dataset.theme === 'dark' ? 'Light' : 'Dark';
        // Re-show deck count so user knows vocab is still loaded
        const total = Object.values(this.languages).reduce((s, c) => s + c.length, 0);
        if (total > 0) showLoadStatus(`${Object.keys(this.languages).length} deck(s) loaded — ${total} entries.`);
    }

    saveToLocalStorage() {}

    renderContent(text) {
        // YouTube
        const ytMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (ytMatch) {
            const videoId = ytMatch[1];
            const label = text.replace(ytMatch[0], '').trim();
            return `${label ? `<div>${this.escapeHtml(label)}</div>` : ''}<iframe width="100%" height="220" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen class="card-media"></iframe>`;
        }

        // Image
        const imgMatch = text.match(/https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?\S*)?/i);
        if (imgMatch) {
            const label = text.replace(imgMatch[0], '').trim();
            return `${label ? `<div>${this.escapeHtml(label)}</div>` : ''}<img src="${imgMatch[0]}" class="card-media" alt="">`;
        }

        // Video
        const vidMatch = text.match(/https?:\/\/\S+\.(?:mp4|webm)(?:\?\S*)?/i);
        if (vidMatch) {
            const label = text.replace(vidMatch[0], '').trim();
            return `${label ? `<div>${this.escapeHtml(label)}</div>` : ''}<video controls class="card-media"><source src="${vidMatch[0]}"></video>`;
        }

        // Audio
        const audioMatch = text.match(/https?:\/\/\S+\.(?:mp3|wav|ogg|aac|flac)(?:\?\S*)?/i);
        if (audioMatch) {
            const label = text.replace(audioMatch[0], '').trim();
            return `${label ? `<div>${this.escapeHtml(label)}</div>` : ''}<audio controls style="width:100%; margin-top:10px;"><source src="${audioMatch[0]}"></audio>`;
        }

        return this.escapeHtml(text);
    }

    escapeHtml(text) {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
            const label = document.createElement('label');
            label.className = 'language-btn';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = lang;
            checkbox.className = 'deck-checkbox';
            checkbox.checked = true;
            checkbox.addEventListener('change', () => {
                label.classList.toggle('selected', checkbox.checked);
                this._updateStartBtn();
                this._updateRightPanel();
            });

            const info = document.createElement('div');
            info.className = 'deck-info';
            info.innerHTML = `<h3>${lang}</h3><p>${cards.length} cards</p>`;

            label.classList.add('selected');
            label.appendChild(checkbox);
            label.appendChild(info);
            grid.appendChild(label);
        }

        this._updateStartBtn();
        this._updateRightPanel();
    }

    _updateStartBtn() {
        const btn = document.getElementById('startSelectedBtn');
        if (!btn) return;
        const checked = document.querySelectorAll('.deck-checkbox:checked');
        btn.style.display = checked.length > 0 ? 'inline-block' : 'none';
        const total = [...checked].reduce((sum, cb) => sum + (this.languages[cb.value]?.length || 0), 0);
        btn.textContent = checked.length > 1 ? `Start (${total} combined cards)` : 'Start';
    }

    _updateRightPanel() {
        const panel = document.getElementById('rightPanel');
        if (!panel) return;

        const checkedBoxes = document.querySelectorAll('.deck-checkbox:checked');
        const allBoxes = document.querySelectorAll('.deck-checkbox');

        // On the home screen there are no checkboxes yet — show all loaded langs
        // On the language screen use whatever is checked
        const langs = allBoxes.length === 0
            ? Object.keys(this.languages)
            : [...checkedBoxes].map(cb => cb.value);

        if (langs.length === 0) {
            panel.innerHTML = '<div class="panel-placeholder"><p>Load a deck to see a preview here.</p></div>';
            return;
        }

        const totalCards = langs.reduce((sum, lang) => sum + (this.languages[lang]?.length || 0), 0);

        let html = `<div class="panel-header"><h2>Card Preview &middot; ${totalCards} card${totalCards !== 1 ? 's' : ''}</h2></div>`;

        for (const lang of langs) {
            const cards = this.languages[lang];
            html += `
                <div class="deck-section">
                    <div class="deck-section-title">${this.escapeHtml(lang)}</div>
                    <table class="deck-table">
                        ${cards.map(card => `
                            <tr>
                                <td class="card-front">${this.escapeHtml(card.front)}</td>
                                <td class="card-back">${this.escapeHtml(card.back)}</td>
                                ${card.notes ? `<td class="card-note">${this.escapeHtml(card.notes)}</td>` : '<td></td>'}
                            </tr>
                        `).join('')}
                    </table>
                </div>`;
        }

        panel.innerHTML = html;
    }

    startSelectedDecks() {
        const checked = [...document.querySelectorAll('.deck-checkbox:checked')].map(cb => cb.value);
        if (checked.length === 0) return;

        const combined = checked.flatMap(lang => this.languages[lang]);
        this.currentLanguage = checked.length === 1 ? checked[0] : checked.join(' + ');
        this.currentCards = [...combined];
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
        const card = this.currentCards[this.currentIndex];
        document.body.innerHTML = `
            <div class="container">
                <div class="session-header">
                    <button class="back-btn" onclick="app.backToLanguages()">← Back</button>
                    <h2>${this.currentLanguage} - Flashcards</h2>
                    <p>Card ${this.currentIndex + 1} of ${this.currentCards.length}</p>
                </div>

                <div class="flashcard" onclick="app.flipCard()">
                    <div class="card-content">
                        <div class="card-text" id="cardText">${this.renderContent(card.front)}</div>
                        ${card.notes ?
                            `<div class="card-notes" id="cardNotes" style="display: none;">${this.escapeHtml(card.notes)}</div>` :
                            ''}
                    </div>
                    <button class="audio-btn" onclick="event.stopPropagation(); app.playPronunciation('${card.front.replace(/'/g, "\\'")}', '${this.currentLanguage}')" title="Play pronunciation">
                        🔊
                    </button>
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
        this.bindFlashcardKeys();
    }

    bindFlashcardKeys() {
        if (this._flashcardKeyHandler) {
            document.removeEventListener('keydown', this._flashcardKeyHandler);
        }
        this._flashcardKeyHandler = (e) => {
            switch (e.key) {
                case 'ArrowLeft':  this.previousCard(); break;
                case 'ArrowRight': this.nextCard(); break;
                case 'ArrowUp':    e.preventDefault(); this.flipCard(); break;
                case 'ArrowDown':  e.preventDefault(); this.flipCard(); break;
                case ' ':          e.preventDefault(); this.playPronunciation(this.currentCards[this.currentIndex].front, this.currentLanguage); break;
                case 's':          this.shuffleCards(); break;
            }
        };
        document.addEventListener('keydown', this._flashcardKeyHandler);
    }

    generateChoices(correctCard) {
        const others = this.currentCards.filter(c => c !== correctCard);
        const shuffled = [...others].sort(() => Math.random() - 0.5);
        const choices = [...shuffled.slice(0, 3), correctCard].sort(() => Math.random() - 0.5);
        return choices;
    }

    showQuizCard() {
        const card = this.currentCards[this.currentIndex];
        this.currentChoices = this.generateChoices(card);

        // Listening mode: ~40% of questions, only for text (not media URLs)
        const hasMedia = /https?:\/\//.test(card.front);
        this.currentIsListening = !hasMedia && Math.random() < 0.4;

        const choiceButtons = this.currentChoices.map((choice, i) =>
            `<button class="choice-btn" id="choice-${i}" onclick="app.selectChoice(${i})">${choice.back}</button>`
        ).join('');

        const audioBtn = `<button class="audio-btn-inline" onclick="app.playPronunciation('${card.front.replace(/'/g, "\\'")}', '${this.currentLanguage}')" title="Play pronunciation">🔊</button>`;

        const questionContent = this.currentIsListening
            ? `<div class="listening-prompt">
                   <div class="listening-icon">${audioBtn}</div>
                   <div class="listening-label">Listening question — identify what you hear</div>
               </div>`
            : `<div class="question-text">
                   <span>${this.renderContent(card.front)}</span>
                   ${audioBtn}
               </div>`;

        const questionPrompt = this.currentIsListening ? 'What are you hearing?' : 'What does this mean?';

        document.body.innerHTML = `
            <div class="container">
                <div class="session-header">
                    <button class="back-btn" onclick="app.backToLanguages()">← Back</button>
                    <h2>${this.currentLanguage} - Quiz</h2>
                    <p>Question ${this.currentIndex + 1} of ${this.currentCards.length}</p>
                    <p>Score: ${this.quizScore}/${this.quizAnswered}</p>
                </div>

                <div class="quiz-card">
                    <div class="question">
                        <h3>${questionPrompt}</h3>
                        ${questionContent}
                    </div>

                    <div class="choices">
                        ${choiceButtons}
                    </div>

                    <div id="result" class="result"></div>
                </div>

                <div class="quiz-controls">
                    <button id="skipBtn" onclick="app.skipQuizCard()">Skip</button>
                    <button id="nextBtn" onclick="app.nextQuizCard()" style="display: none;">Next →</button>
                </div>
            </div>
        `;
        this.addQuizStyles();

        if (this.currentIsListening) {
            setTimeout(() => this.playPronunciation(card.front, this.currentLanguage), 400);
        }
    }

    skipQuizCard() {
        if (this.currentIndex < this.currentCards.length - 1) {
            this.currentIndex++;
            this.showQuizCard();
        } else {
            this.showQuizResults();
        }
    }

    selectChoice(choiceIndex) {
        const card = this.currentCards[this.currentIndex];
        const isCorrect = this.currentChoices[choiceIndex] === card;

        this.quizAnswered++;
        if (isCorrect) this.quizScore++;

        this.currentChoices.forEach((choice, i) => {
            const btn = document.getElementById(`choice-${i}`);
            btn.disabled = true;
            if (choice === card) {
                btn.classList.add('choice-correct');
            } else if (i === choiceIndex) {
                btn.classList.add('choice-wrong');
            }
        });

        // Reveal term for listening questions after answering
        if (this.currentIsListening) {
            const prompt = document.querySelector('.listening-prompt');
            if (prompt) prompt.innerHTML = `<div class="question-text"><span>${this.escapeHtml(card.front)}</span></div>`;
        }

        const result = document.getElementById('result');
        result.innerHTML = (isCorrect
            ? `<div class="correct">✅ Correct!</div>`
            : `<div class="incorrect">❌ The correct answer was: <strong>${card.back}</strong></div>`)
            + (card.notes ? `<div class="result-notes">${this.escapeHtml(card.notes)}</div>` : '');

        document.getElementById('skipBtn').style.display = 'none';
        document.getElementById('nextBtn').style.display = 'inline-block';
    }

    flipCard() {
        const cardText = document.getElementById('cardText');
        const cardNotes = document.getElementById('cardNotes');

        if (!this.showingBack) {
            cardText.innerHTML = this.renderContent(this.currentCards[this.currentIndex].back);
            if (cardNotes) cardNotes.style.display = 'block';
            this.showingBack = true;
        } else {
            cardText.innerHTML = this.renderContent(this.currentCards[this.currentIndex].front);
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
                        <button onclick="app.backToLanguages()" class="back-btn">Back to Languages</button>
                        <button onclick="showHome()" class="back-btn">Home</button>
                    </div>
                </div>
            </div>
        `;
        this.addResultStyles();
    }

    backToLanguages() {
        this._restoreHome();
    }

    addFlashcardStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body, button, input { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text-2); }

            .session-header { text-align: center; margin-bottom: 30px; color: var(--text-1); }
            .session-header h2 { color: var(--text-1); }
            .session-header p { color: var(--text-3); }

            .flashcard {
                background: var(--surface);
                border-radius: 15px;
                box-shadow: 0 10px 30px var(--shadow);
                padding: 40px;
                margin: 30px 0;
                min-height: 300px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: transform 0.2s;
                position: relative;
            }
            .flashcard:hover { transform: translateY(-5px); }

            .card-content { text-align: center; width: 100%; position: relative; }
            .card-text { font-size: 2em; font-weight: bold; margin-bottom: 20px; color: var(--text-2); }
            .card-notes { font-size: 1em; color: var(--text-3); font-style: italic; }

            .card-media {
                max-width: 100%; max-height: 220px; border-radius: 8px;
                margin: 10px auto 0; display: block;
            }

            .audio-btn {
                position: absolute; bottom: 15px; right: 15px;
                background: var(--accent); border: none; border-radius: 50%;
                width: 50px; height: 50px; font-size: 1.5em;
                cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px var(--shadow);
            }
            .audio-btn:hover { background: var(--accent-2); transform: scale(1.1); }
            .audio-btn:active { transform: scale(0.95); }

            .controls { display: flex; justify-content: space-between; gap: 10px; margin-top: 20px; }
            .controls button {
                flex: 1; padding: 15px; border: 1.5px solid var(--border);
                border-radius: 10px; cursor: pointer; font-size: 1em;
                background: var(--surface); color: var(--text-2);
            }
            .flip-btn { background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%) !important; color: white !important; border: none !important; }

            .shuffle-btn { text-align: center; margin-top: 20px; }
            .shuffle-btn button {
                background: var(--surface); border: 1.5px solid var(--border);
                border-radius: 10px; padding: 10px 20px; cursor: pointer;
                color: var(--text-2); font-size: 0.95em;
            }
        `;
        document.head.appendChild(style);
    }

    addQuizStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body, button, input { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text-2); }

            .session-header { text-align: center; margin-bottom: 20px; color: var(--text-1); }
            .session-header h2 { color: var(--text-1); }
            .session-header p { color: var(--text-3); }

            .quiz-card {
                background: var(--surface);
                border-radius: 15px;
                box-shadow: 0 10px 30px var(--shadow);
                padding: 30px; margin: 20px 0;
            }
            .question { text-align: center; margin-bottom: 30px; }
            .question-text {
                font-size: 2em; font-weight: bold; margin: 20px 0;
                color: var(--text-2); display: flex; align-items: center;
                justify-content: center; gap: 15px;
            }

            .card-media {
                max-width: 100%; max-height: 220px; border-radius: 8px;
                margin: 10px auto 0; display: block;
            }

            .audio-btn-inline {
                background: var(--accent); border: none; border-radius: 50%;
                width: 45px; height: 45px; font-size: 1.3em;
                cursor: pointer; transition: all 0.2s;
                box-shadow: 0 2px 8px var(--shadow); flex-shrink: 0;
            }
            .audio-btn-inline:hover { background: var(--accent-2); transform: scale(1.1); }
            .audio-btn-inline:active { transform: scale(0.95); }

            .choices { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
            .choice-btn {
                padding: 18px 12px; font-size: 1em;
                border: 2px solid var(--border); border-radius: 10px;
                background: var(--surface); color: var(--text-2);
                cursor: pointer; transition: all 0.15s; text-align: center; line-height: 1.4;
            }
            .choice-btn:hover:not(:disabled) { border-color: var(--accent); background: var(--deck-hover-bg); }
            .choice-btn:disabled { cursor: default; }

            .choice-correct { background: #d4edda !important; border-color: #28a745 !important; color: #155724; }
            .choice-wrong   { background: #f8d7da !important; border-color: #dc3545 !important; color: #721c24; }

            .result { margin: 15px 0; padding: 12px; border-radius: 10px; text-align: center; font-size: 1.1em; }
            .correct   { background: #d4edda; color: #155724; }
            .incorrect { background: #f8d7da; color: #721c24; }
            .result-notes { margin-top: 8px; font-size: 0.85em; color: var(--text-3); font-style: italic; }

            .listening-prompt { text-align: center; padding: 20px 0; }
            .listening-icon { margin-bottom: 12px; }
            .listening-icon .audio-btn-inline { width: 64px; height: 64px; font-size: 1.8em; }
            .listening-label { font-size: 0.82em; color: var(--text-3); letter-spacing: 0.3px; }

            .quiz-controls { text-align: center; margin-top: 15px; display: flex; justify-content: center; gap: 10px; }
            .quiz-controls button {
                padding: 12px 30px; border: none; border-radius: 8px;
                cursor: pointer; font-size: 1em;
                background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
                color: white;
            }
            #skipBtn {
                background: var(--surface) !important;
                color: var(--text-3) !important;
                border: 1.5px solid var(--border) !important;
            }
        `;
        document.head.appendChild(style);
    }

    addResultStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .quiz-results { text-align: center; }
            .score-display { margin: 30px 0; }
            .score { font-size: 3em; font-weight: bold; color: var(--text-2); }
            .percentage { font-size: 2em; color: var(--accent); margin-top: 10px; }
        `;
        document.head.appendChild(style);
    }
}

const app = new FlashcardApp();

function showLoadStatus(msg, isError = false) {
    const el = document.getElementById('loadStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.style.opacity = '1';
    el.style.color = isError ? '#c0392b' : '#155724';
    el.style.background = isError ? '#fdf2f2' : '#d4edda';
    el.style.border = `1.5px solid ${isError ? '#f5c6cb' : '#c3e6cb'}`;
    if (!isError) {
        clearTimeout(el._fadeTimer);
        el._fadeTimer = setTimeout(() => { el.style.opacity = '0'; }, 3000);
    }
}

function showHome() {
    app._restoreHome();
}

function showLanguages(mode) {
    if (Object.keys(app.languages).length === 0) {
        document.getElementById('noVocabWarning').style.display = 'block';
        return;
    }
    document.getElementById('noVocabWarning').style.display = 'none';
    app.currentMode = mode;
    document.getElementById('homeScreen').style.display = 'none';
    document.getElementById('languageScreen').style.display = 'block';
    document.getElementById('modeTitle').textContent =
        mode === 'flashcard' ? 'Select Specialty for Flashcards' : 'Select Specialty for Quiz';
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
                showLoadStatus(`Loaded ${Object.keys(app.languages).length} deck(s).`);
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
        alert('Please enter a specialty name!');
        return;
    }

    // Check if we're on file:// protocol
    if (window.location.protocol === 'file:') {
        alert('URL loading is blocked when opening the file directly.\n\nPlease use one of these methods:\n1. Use the GitHub Pages site\n2. Copy/paste the content instead (see "Or Paste Content Directly" section)');
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

            showLoadStatus(`Loaded ${result.count} entries for "${languageName}".`);
            urlInput.value = '';
            languageNameInput.value = '';
        } else {
            alert(`Failed to load vocabulary: ${result.error}\n\nTip: Try the "Paste Content Directly" option instead.`);
        }
    } catch (error) {
        alert(`Error loading from URL: ${error.message}\n\nTip: Try the "Paste Content Directly" option instead.`);
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

function loadFromPaste() {
    try {
        const pasteInput = document.getElementById('pasteInput');
        const languageNameInput = document.getElementById('pasteLanguageName');

        if (!pasteInput || !languageNameInput) {
            alert('Error: Could not find input elements. Please refresh the page.');
            return;
        }

        const content = pasteInput.value.trim();
        const languageName = languageNameInput.value.trim();

        if (!content) {
            alert('Please paste some vocabulary content!');
            return;
        }

        if (!languageName) {
            alert('Please enter a specialty name!');
            return;
        }

        const cards = app.parseFile(languageName, content);

        if (cards.length > 0) {
            app.languages[languageName] = cards;
            const saved = app.saveToLocalStorage();
            app.updateLanguageGrid();

            showLoadStatus(`Loaded ${cards.length} entries for "${languageName}".`);
            pasteInput.value = '';
            languageNameInput.value = '';
        } else {
            alert('No valid entries found. Make sure format is: term|definition|notes');
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
        console.error('loadFromPaste error:', error);
    }
}

// GitHub repository configuration
const GITHUB_CONFIG = {
    baseUrl: 'https://raw.githubusercontent.com/sterlingalston/language-study/refs/heads/master/vocabulary',
    files: {
        'Japanese': ['japanese_essentials.txt', 'japanese_introductions.txt', 'japanese_occupations.txt', 'hiragana_vowels.txt', 'hiragana_ka_ki_ku_ke_ko.txt'],
        'German': ['german_vocabulary.txt'],
        'Spanish': ['spanish_greetings.txt', 'spanish_introductions.txt', 'spanish_location.txt', 'spanish_family.txt', 'spanish_appearance.txt'],
        'Chinese': ['chinese_vocabulary.txt'],
        'Icelandic': ['icelandic_vocabulary.txt']
    }
};

// Active config — null means use GITHUB_CONFIG
let activeGithubConfig = null;

function parseGithubRepo(input) {
    input = input.trim().replace(/\.git$/, '');
    const urlMatch = input.match(/github\.com\/([^\/\s]+)\/([^\/\s]+)/);
    if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };
    const slashMatch = input.match(/^([^\/\s]+)\/([^\/\s]+)$/);
    if (slashMatch) return { owner: slashMatch[1], repo: slashMatch[2] };
    return null;
}

function populateLanguageSelect(config) {
    const select = document.getElementById('githubLanguageSelect');
    select.innerHTML = '<option value="">-- Select Language --</option>';
    for (const lang of Object.keys(config.files)) {
        const option = document.createElement('option');
        option.value = lang;
        option.textContent = lang;
        select.appendChild(option);
    }
    document.getElementById('githubFileList').style.display = 'none';
}

async function fetchCustomRepo(event) {
    const input = document.getElementById('customRepoInput').value.trim();

    if (!input) {
        activeGithubConfig = null;
        populateLanguageSelect(GITHUB_CONFIG);
        return;
    }

    const parsed = parseGithubRepo(input);
    if (!parsed) {
        alert('Could not parse repository. Use format: owner/repo or https://github.com/owner/repo');
        return;
    }

    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = 'Fetching...';
    btn.disabled = true;

    try {
        const apiBase = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/vocabulary`;
        const res = await fetch(apiBase);
        if (!res.ok) throw new Error(`GitHub API returned ${res.status} — check the repo name and that it has a vocabulary/ folder`);

        const items = await res.json();
        const langDirs = items.filter(item => item.type === 'dir');
        if (langDirs.length === 0) throw new Error('No specialty directories found inside vocabulary/');

        const files = {};
        for (const dir of langDirs) {
            const dirRes = await fetch(`${apiBase}/${dir.name}`);
            if (!dirRes.ok) continue;
            const dirItems = await dirRes.json();
            const txtFiles = dirItems
                .filter(f => f.type === 'file' && (f.name.endsWith('.txt') || f.name.endsWith('.csv')))
                .map(f => f.name);
            if (txtFiles.length > 0) files[dir.name] = txtFiles;
        }

        if (Object.keys(files).length === 0) throw new Error('No .txt or .csv files found in any specialty directory');

        activeGithubConfig = {
            baseUrl: `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/HEAD/vocabulary`,
            files
        };

        populateLanguageSelect(activeGithubConfig);
    } catch (error) {
        alert(`Failed to fetch repo structure: ${error.message}`);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Handle language selection change
function handleGithubLanguageChange() {
    const select = document.getElementById('githubLanguageSelect');
    const fileListDiv = document.getElementById('githubFileList');
    const checkboxesDiv = document.getElementById('fileCheckboxes');

    const selectedLanguage = select.value;

    if (!selectedLanguage) {
        fileListDiv.style.display = 'none';
        return;
    }

    const config = activeGithubConfig || GITHUB_CONFIG;
    const files = config.files[selectedLanguage] || [];

    checkboxesDiv.innerHTML = '';
    files.forEach(file => {
        const label = document.createElement('label');
        label.style.display = 'block';
        label.style.padding = '5px';
        label.style.cursor = 'pointer';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = file;
        checkbox.checked = true;
        checkbox.style.marginRight = '10px';

        const fileName = file.replace('.txt', '').replace(/_/g, ' ');
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(fileName));

        checkboxesDiv.appendChild(label);
    });

    fileListDiv.style.display = files.length > 0 ? 'block' : 'none';
}

// Load vocabulary from GitHub
async function loadFromGithub(event) {
    const select = document.getElementById('githubLanguageSelect');
    const checkboxes = document.querySelectorAll('#fileCheckboxes input[type="checkbox"]:checked');

    const selectedLanguage = select.value;

    if (!selectedLanguage) {
        alert('Please select a specialty first!');
        return;
    }

    if (checkboxes.length === 0) {
        alert('Please select at least one file to load!');
        return;
    }

    // Check if we're on file:// protocol
    if (window.location.protocol === 'file:') {
        alert('GitHub loading is blocked when opening the file directly.\n\nPlease use one of these methods:\n1. Use the GitHub Pages site\n2. Copy/paste the content instead (see "Paste Content Directly" section)');
        return;
    }

    const button = event ? event.target : document.querySelector('button[onclick*="loadFromGithub"]');
    const originalText = button.textContent;
    button.textContent = 'Loading...';
    button.disabled = true;

    try {
        let totalLoaded = 0;
        const errors = [];

        const config = activeGithubConfig || GITHUB_CONFIG;
        for (const checkbox of checkboxes) {
            const fileName = checkbox.value;
            const url = `${config.baseUrl}/${selectedLanguage}/${fileName}`;
            const displayName = fileName.replace('.txt', '').replace(/_/g, ' ');
            const languageName = `${selectedLanguage} - ${displayName}`;

            console.log(`Loading from: ${url}`);

            try {
                const result = await app.loadFromUrl(url, languageName);

                if (result.success) {
                    totalLoaded += result.count;
                    console.log(`✓ Loaded ${result.count} entries from ${fileName}`);
                } else {
                    errors.push(`${fileName}: ${result.error}`);
                    console.error(`✗ Failed to load ${fileName}:`, result.error);
                }
            } catch (error) {
                errors.push(`${fileName}: ${error.message}`);
                console.error(`✗ Error loading ${fileName}:`, error);
            }
        }

        app.updateLanguageGrid();

        if (errors.length > 0) {
            showLoadStatus(`Loaded ${totalLoaded} entries. Errors: ${errors.join('; ')}`, true);
        } else {
            showLoadStatus(`Loaded ${totalLoaded} entries across ${checkboxes.length} file(s).`);
        }

        // Reset selection
        select.value = '';
        handleGithubLanguageChange();

    } catch (error) {
        alert(`Error loading from GitHub: ${error.message}`);
        console.error('loadFromGithub error:', error);
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

async function fetchDefaultRepo() {
    const { owner, repo } = { owner: 'sterlingalston', repo: 'language-study' };
    try {
        const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/vocabulary`;
        const res = await fetch(apiBase);
        if (!res.ok) return;
        const items = await res.json();
        const langDirs = items.filter(item => item.type === 'dir');
        if (langDirs.length === 0) return;

        const files = {};
        for (const dir of langDirs) {
            const dirRes = await fetch(`${apiBase}/${dir.name}`);
            if (!dirRes.ok) continue;
            const dirItems = await dirRes.json();
            const txtFiles = dirItems
                .filter(f => f.type === 'file' && (f.name.endsWith('.txt') || f.name.endsWith('.csv')))
                .map(f => f.name);
            if (txtFiles.length > 0) files[dir.name] = txtFiles;
        }

        if (Object.keys(files).length === 0) return;

        activeGithubConfig = {
            baseUrl: `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/vocabulary`,
            files
        };
        populateLanguageSelect(activeGithubConfig);
    } catch (_) {
        // silently fall back to GITHUB_CONFIG
    }
}

window.onload = function() {
    app.init();

    // Add event listener for GitHub language selector
    const githubSelect = document.getElementById('githubLanguageSelect');
    if (githubSelect) {
        githubSelect.addEventListener('change', handleGithubLanguageChange);
    }

    fetchDefaultRepo();
};