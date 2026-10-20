const { useState, useEffect, useRef } = React;

const firebaseConfig = {
    apiKey: "AIzaSyDRNfbYa7hQPKqU7iG39Cav7uYR2ZxoPzk",
    authDomain: "exam-page-52ca7.firebaseapp.com",
    projectId: "exam-page-52ca7",
    storageBucket: "exam-page-52ca7.firebasestorage.app",
    messagingSenderId: "443344349852",
    appId: "1:443344349852:web:5eb470af4438d24e12db59",
    measurementId: "G-PTZ7700E40"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const storage = firebase.storage();

const ImageUploadZone = ({ currentImage, onUploadSuccess }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef(null);

    const handleFile = (file) => {
        if (!file || !file.type.startsWith('image/')) {
            alert('Please upload a valid image file.');
            return;
        }

        setIsProcessing(true);
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                // Automatically resize & compress the image so it fits into Firestore
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Resize large images to a max width of 800px
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = Math.round(height * (MAX_WIDTH / width));
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert canvas image to compressed JPEG string (70% quality)
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                onUploadSuccess(compressedBase64);
                setIsProcessing(false);
            };
        };

        reader.onerror = () => {
            alert("Failed to read image file.");
            setIsProcessing(false);
        };

        reader.readAsDataURL(file);
    };

    const onDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = () => {
        setIsDragging(false);
    };

    const onDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    return (
        <div className="mt-3">
            <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-gray-800">Block Image Graphic</label>
                {currentImage && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onUploadSuccess('');
                        }}
                        className="text-[11px] font-semibold text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                    >
                        ✕ Remove Image
                    </button>
                )}
            </div>

            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !isProcessing && fileInputRef.current.click()}
                className={`w-full border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'
                    } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                    className="hidden"
                />

                {isProcessing ? (
                    <span className="text-xs text-blue-600 font-bold animate-pulse">Compressing Image...</span>
                ) : currentImage ? (
                    <div className="relative w-full flex flex-col items-center">
                        <img src={currentImage} alt="Uploaded block graphic" className="max-h-36 object-contain rounded shadow-sm border border-gray-200" />
                        <span className="text-[10px] text-gray-500 mt-2 font-medium">Click or drag a new image to replace</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-gray-400 hover:text-blue-500 transition-colors py-2">
                        <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                        <span className="text-xs font-semibold text-gray-600">Click or drag & drop an image here</span>
                        <span className="text-[10px] text-gray-400 mt-0.5">Auto-compressed for fast loading</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const parseBlockQuestions = (rawText, defaultPassageTitle, defaultPassage, defaultIsHTML, defaultBlockImage, startIdx = 1) => {
    if (!rawText.trim()) return [];

    const blocks = rawText.trim().split(/\n\s*\n/);
    const parsedQuestions = [];

    blocks.forEach((block) => {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) return;

        let questionText = "";
        const options = [];
        let correctAnswer = "";
        let explanation = "";
        let passageTitle = defaultPassageTitle || "";
        let passage = defaultPassage || "";
        let isHTML = defaultIsHTML || false;
        let image = defaultBlockImage || "";

        lines.forEach(line => {
            const ansMatch = line.match(/^(?:Answer|Ans|Correct)[:\s]*([A-D])/i);
            const optMatch = line.match(/^([A-D])[\.\)]\s*(.+)/i);
            const expMatch = line.match(/^(?:Explanation|Exp)[:\s]*(.+)/i);
            const pTitleMatch = line.match(/^(?:Passage Title|Title)[:\s]*(.+)/i);
            const pHtmlMatch = line.match(/^(?:Passage HTML|HTML Passage|Table)[:\s]*(.+)/i);
            const pMatch = line.match(/^(?:Passage)[:\s]*(.+)/i);
            const imgMatch = line.match(/^(?:Image|Img)[:\s]*(.+)/i);

            if (ansMatch) {
                correctAnswer = ansMatch[1].toUpperCase();
            } else if (expMatch) {
                explanation = expMatch[1].trim();
            } else if (pTitleMatch) {
                passageTitle = pTitleMatch[1].trim();
            } else if (pHtmlMatch) {
                passage = pHtmlMatch[1].trim();
                isHTML = true;
            } else if (pMatch) {
                passage = pMatch[1].trim();
            } else if (imgMatch) {
                image = imgMatch[1].trim();
            } else if (optMatch) {
                options.push({
                    id: optMatch[1].toUpperCase(),
                    text: optMatch[2]
                });
            } else {
                questionText += (questionText ? "\n" : "") + line.replace(/^\d+[\.\)]\s*/, '');
            }
        });

        if (questionText && options.length > 0) {
            parsedQuestions.push({
                id: startIdx + parsedQuestions.length,
                text: questionText,
                options: options,
                correctAnswer: correctAnswer || options[0].id,
                explanation: explanation || "",
                passageTitle: passageTitle || "",
                passage: passage || "",
                isHTML: isHTML || false,
                image: image || ""
            });
        }
    });

    return parsedQuestions;
};

const MathText = ({ text }) => {
    const containerRef = useRef(null);

    useEffect(() => {
        let isCancelled = false;
        const renderMath = () => {
            if (isCancelled) return;
            if (containerRef.current) {
                containerRef.current.textContent = text || '';
                if (window.MathJax && window.MathJax.typesetPromise) {
                    window.MathJax.typesetClear([containerRef.current]);
                    window.MathJax.typesetPromise([containerRef.current]).catch((err) => console.log('MathJax error:', err));
                } else {
                    setTimeout(renderMath, 100);
                }
            }
        };
        renderMath();
        return () => { isCancelled = true; };
    }, [text]);

    return <span ref={containerRef} />;
};
const Passage = ({ title, text, isHTML }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg overflow-hidden shadow-sm">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full px-5 py-3 flex justify-between items-center bg-blue-100 hover:bg-blue-200 transition-colors text-blue-900 font-bold focus:outline-none text-left">
                <span>{title || "Reading Passage / Reference Data"}</span>
                <svg className={`w-5 h-5 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            {isOpen && (
                <div className="px-5 py-4 bg-white border-t border-blue-100 text-gray-800 text-sm sm:text-base leading-relaxed overflow-x-auto">
                    {isHTML ? <div dangerouslySetInnerHTML={{ __html: text }} /> : text.split('\n\n').map((p, i) => <p key={i} className="mb-3 last:mb-0">{p}</p>)}
                </div>
            )}
        </div>
    );
};

function App() {
    const [exams, setExams] = useState([]);
    const [loadingExams, setLoadingExams] = useState(true);
    const [currentView, setCurrentView] = useState('dashboard');
    const [activeExam, setActiveExam] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [flagged, setFlagged] = useState({});
    const [flagReasons, setFlagReasons] = useState({});
    const [score, setScore] = useState(0);

    const [uatSection, setUatSection] = useState(null);

    const [highScores, setHighScores] = useState(() => {
        try {
            const saved = localStorage.getItem('exam_high_scores');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    });

    const [examHistory, setExamHistory] = useState(() => {
        try {
            const saved = localStorage.getItem('exam_history_logs');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    });

    const [examBlocks, setExamBlocks] = useState([
        { id: 1, startQ: 1, endQ: 60, passageTitle: '', passage: '', isHTML: false, blockImage: '', rawText: '' }
    ]);
    const [uatEnglishBlocks, setUatEnglishBlocks] = useState([
        { id: 1, startQ: 1, endQ: 55, passageTitle: '', passage: '', isHTML: false, blockImage: '', rawText: '' }
    ]);
    const [uatMathBlocks, setUatMathBlocks] = useState([
        { id: 2, startQ: 56, endQ: 100, passageTitle: '', passage: '', isHTML: false, blockImage: '', rawText: '' }
    ]);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('All');
    const [customSubjects, setCustomSubjects] = useState(['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English']);

    const [selectedExamStats, setSelectedExamStats] = useState(null);

    const [showAddModal, setShowAddModal] = useState(false);
    const [examTitle, setExamTitle] = useState('');
    const [examType, setExamType] = useState('default');
    const [examSubject, setExamSubject] = useState('');
    const [examDuration, setExamDuration] = useState(60);
    const [examDescription, setExamDescription] = useState('');
    const [totalQuestions, setTotalQuestions] = useState(60);

    const [isSavingExam, setIsSavingExam] = useState(false);

    const [editingExam, setEditingExam] = useState(null);
    const [editQuestions, setEditQuestions] = useState([]);
    const [isUpdatingExam, setIsUpdatingExam] = useState(false);

    const [examToDelete, setExamToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [timerStatus, setTimerStatus] = useState('idle');
    const [timeLeft, setTimeLeft] = useState(0);
    const [isTimerHidden, setIsTimerHidden] = useState(false);
    const [inputHours, setInputHours] = useState(1);
    const [inputMinutes, setInputMinutes] = useState(0);
    const [inputSeconds, setInputSeconds] = useState(0);

    const [showResetModal, setShowResetModal] = useState(false);
    const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportSelectedIds, setExportSelectedIds] = useState(new Set());
    const [copySuccess, setCopySuccess] = useState(false);

    useEffect(() => {
        const fetchExams = async () => {
            try {
                const snapshot = await db.collection('exams').get();
                const fetchedList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setExams(fetchedList);
            } catch (err) {
                console.error("Error fetching exams: ", err);
            } finally {
                setLoadingExams(false);
            }
        };
        fetchExams();
    }, []);

    useEffect(() => {
        let interval = null;
        if (timerStatus === 'running' && timeLeft > 0) {
            interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
        } else if (timeLeft === 0 && timerStatus === 'running') {
            if (activeExam?.type === 'UAT' && uatSection === 'english') {
                handleStartMath();
            } else {
                handleSubmit();
            }
        }
        return () => { if (interval) clearInterval(interval); };
    }, [timerStatus, timeLeft, activeExam, uatSection]);

    useEffect(() => {
        if (currentView !== 'dashboard') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [currentView]);

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (currentView === 'exam' && timerStatus === 'running') {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [currentView, timerStatus]);

    // 2. Auto-save exam state to localStorage
    useEffect(() => {
        if (currentView === 'exam' && activeExam) {
            const activeSession = {
                activeExamId: activeExam.id,
                answers,
                timeLeft,
                currentIndex,
                uatSection,
                timerStatus
            };
            localStorage.setItem('exam_in_progress', JSON.stringify(activeSession));
        }
    }, [currentView, activeExam, answers, timeLeft, currentIndex, uatSection, timerStatus]);

    // 3. Restore exam session after exams load
    useEffect(() => {
        if (!loadingExams && exams.length > 0 && currentView === 'dashboard') {
            const savedSessionStr = localStorage.getItem('exam_in_progress');
            if (savedSessionStr) {
                try {
                    const sessionData = JSON.parse(savedSessionStr);
                    const examToRestore = exams.find(e => e.id === sessionData.activeExamId);

                    if (examToRestore) {
                        setActiveExam(examToRestore);
                        setAnswers(sessionData.answers || {});
                        setTimeLeft(sessionData.timeLeft);
                        setCurrentIndex(sessionData.currentIndex || 0);
                        setUatSection(sessionData.uatSection || null);
                        setTimerStatus(sessionData.timerStatus || 'running');
                        setCurrentView('exam');
                    }
                } catch (e) {
                    console.error("Failed to restore exam session", e);
                    localStorage.removeItem('exam_in_progress');
                }
            }
        }
    }, [loadingExams, exams]);

    // 4. Keyboard Shortcuts for Navigation and Selection
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Do nothing if the user is typing in a text field (e.g., search, flag reasons)
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Only trigger during the exam or result review
            if (currentView !== 'exam' && currentView !== 'results') return;

            const isFinished = currentView === 'results';

            if (e.key === 'ArrowRight') {
                setCurrentIndex(prev => {
                    let isNextDisabled = false;
                    if (activeExam?.type === 'UAT' && !isFinished) {
                        if (uatSection === 'english') isNextDisabled = prev === 54;
                        else if (uatSection === 'math') isNextDisabled = prev === activeExam.questions.length - 1;
                    } else {
                        isNextDisabled = prev === (activeExam?.questions?.length || 1) - 1;
                    }
                    return isNextDisabled ? prev : prev + 1;
                });
            } else if (e.key === 'ArrowLeft') {
                setCurrentIndex(prev => {
                    let isPrevDisabled = false;
                    if (activeExam?.type === 'UAT' && !isFinished) {
                        if (uatSection === 'english') isPrevDisabled = prev === 0;
                        else if (uatSection === 'math') isPrevDisabled = prev === 55;
                    } else {
                        isPrevDisabled = prev === 0;
                    }
                    return isPrevDisabled ? prev : prev - 1;
                });
            } else if (!isFinished) {
                // Selection mapped to A, B, C, D keys
                const key = e.key.toUpperCase();
                const question = activeExam?.questions[currentIndex];

                if (question && ['A', 'B', 'C', 'D', 'E'].includes(key)) {
                    // Verify the option actually exists for this question
                    const validOption = question.options.some(o => o.id === key);
                    if (validOption) {
                        setAnswers(prev => ({ ...prev, [question.id]: key }));
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentView, activeExam, currentIndex, uatSection]);

    const handleTotalQuestionsChange = (val) => {
        const count = Math.max(1, Number(val));
        setTotalQuestions(count);
        setExamBlocks(prev => {
            if (prev.length === 1) return [{ ...prev[0], endQ: count }];
            const updated = [...prev];
            updated[updated.length - 1].endQ = count;
            return updated;
        });
    };

    const handleUpdateBlock = (index, field, value, sectionType = 'default') => {
        let targetBlocks = examBlocks;
        let setTargetBlocks = setExamBlocks;

        if (sectionType === 'english') { targetBlocks = uatEnglishBlocks; setTargetBlocks = setUatEnglishBlocks; }
        if (sectionType === 'math') { targetBlocks = uatMathBlocks; setTargetBlocks = setUatMathBlocks; }

        const updated = [...targetBlocks];
        updated[index][field] = value;
        if (field === 'endQ' && index < updated.length - 1) {
            const newEnd = Math.max(updated[index].startQ, Number(value));
            updated[index].endQ = newEnd;
            updated[index + 1].startQ = newEnd + 1;
        }
        setTargetBlocks(updated);
    };

    const handleAddBlock = (sectionType = 'default') => {
        let targetBlocks = examBlocks;
        let setTargetBlocks = setExamBlocks;

        if (sectionType === 'english') { targetBlocks = uatEnglishBlocks; setTargetBlocks = setUatEnglishBlocks; }
        if (sectionType === 'math') { targetBlocks = uatMathBlocks; setTargetBlocks = setUatMathBlocks; }

        const lastBlock = targetBlocks[targetBlocks.length - 1];
        const nextStart = lastBlock ? lastBlock.endQ + 1 : 1;
        let nextEnd = nextStart + 9;

        if (sectionType === 'english') nextEnd = Math.min(nextStart + 9, 55);
        if (sectionType === 'math') nextEnd = Math.min(nextStart + 9, 100);

        setTargetBlocks([
            ...targetBlocks,
            { id: Date.now(), startQ: nextStart, endQ: nextEnd, passageTitle: '', passage: '', isHTML: false, blockImage: '', rawText: '' }
        ]);
    };

    const handleRemoveBlock = (index, sectionType = 'default') => {
        let targetBlocks = examBlocks;
        let setTargetBlocks = setExamBlocks;
        let startBase = 1;

        if (sectionType === 'english') { targetBlocks = uatEnglishBlocks; setTargetBlocks = setUatEnglishBlocks; }
        if (sectionType === 'math') { targetBlocks = uatMathBlocks; setTargetBlocks = setUatMathBlocks; startBase = 56; }

        if (targetBlocks.length <= 1) return;
        const updated = targetBlocks.filter((_, idx) => idx !== index);

        let currentStart = startBase;
        updated.forEach((b) => {
            const span = Math.max(0, b.endQ - b.startQ);
            b.startQ = currentStart;
            b.endQ = currentStart + span;
            currentStart = b.endQ + 1;
        });
        setTargetBlocks(updated);
    };

    const handleSaveExamToFirestore = async () => {
        const effectiveSubject = examType === 'UAT' ? (examSubject || 'UAT') : examSubject;

        if (!examTitle || (examType !== 'UAT' && !examSubject)) {
            alert("Please provide an Exam Title and Subject.");
            return;
        }

        let compiledQuestions = [];

        if (examType === 'UAT') {
            uatEnglishBlocks.forEach((block) => {
                if (block.rawText.trim()) {
                    compiledQuestions = compiledQuestions.concat(parseBlockQuestions(block.rawText, block.passageTitle, block.passage, block.isHTML, block.blockImage, block.startQ));
                }
            });
            uatMathBlocks.forEach((block) => {
                if (block.rawText.trim()) {
                    compiledQuestions = compiledQuestions.concat(parseBlockQuestions(block.rawText, block.passageTitle, block.passage, block.isHTML, block.blockImage, block.startQ));
                }
            });
        } else {
            examBlocks.forEach((block) => {
                if (block.rawText.trim()) {
                    compiledQuestions = compiledQuestions.concat(parseBlockQuestions(block.rawText, block.passageTitle, block.passage, block.isHTML, block.blockImage, block.startQ));
                }
            });
        }

        compiledQuestions = compiledQuestions.map((q, idx) => ({ ...q, id: idx + 1 }));

        if (compiledQuestions.length === 0) {
            alert("Please paste and enter valid questions in at least one block.");
            return;
        }

        setIsSavingExam(true);
        const slug = examTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'exam';
        const generatedId = `${slug}-${Date.now()}`;

        const newExamObj = {
            id: generatedId,
            title: examTitle,
            type: examType,
            subject: effectiveSubject,
            durationMinutes: examType === 'UAT' ? 150 : Number(examDuration),
            description: examDescription,
            questions: compiledQuestions,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await db.collection('exams').doc(generatedId).set(newExamObj);
            setExams(prev => [newExamObj, ...prev]);

            setExamTitle('');
            setExamType('default');
            setExamSubject('');
            setExamDuration(60);
            setExamDescription('');
            setTotalQuestions(60);
            setExamBlocks([{ id: 1, startQ: 1, endQ: 60, passageTitle: '', passage: '', isHTML: false, blockImage: '', rawText: '' }]);
            setUatEnglishBlocks([{ id: 1, startQ: 1, endQ: 55, passageTitle: '', passage: '', isHTML: false, blockImage: '', rawText: '' }]);
            setUatMathBlocks([{ id: 2, startQ: 56, endQ: 100, passageTitle: '', passage: '', isHTML: false, blockImage: '', rawText: '' }]);
            setShowAddModal(false);

            alert(`Exam successfully saved with ${compiledQuestions.length} questions!`);
        } catch (error) {
            console.error("Error saving exam to Firestore: ", error);
            alert("Failed to save exam.");
        } finally {
            setIsSavingExam(false);
        }
    };

    const handleOpenEditModal = (exam) => {
        setEditingExam({ ...exam });
        setEditQuestions(JSON.parse(JSON.stringify(exam.questions || [])));
    };

    const handleUpdateQuestionField = (qIdx, field, val) => {
        const updated = [...editQuestions];
        updated[qIdx][field] = val;
        setEditQuestions(updated);
    };

    const handleUpdateOptionText = (qIdx, optIdx, val) => {
        const updated = [...editQuestions];
        updated[qIdx].options[optIdx].text = val;
        setEditQuestions(updated);
    };

    const handleAddQuestionToEdit = () => {
        const newQ = {
            id: editQuestions.length + 1,
            text: "New Question Text",
            passageTitle: "",
            passage: "",
            isHTML: false,
            options: [
                { id: "A", text: "Option A" },
                { id: "B", text: "Option B" },
                { id: "C", text: "Option C" },
                { id: "D", text: "Option D" }
            ],
            correctAnswer: "A",
            explanation: ""
        };
        setEditQuestions([...editQuestions, newQ]);
    };

    const handleDeleteQuestionFromEdit = (qIdx) => {
        if (window.confirm("Are you sure you want to delete this question? This action cannot be undone.")) {
            const updated = editQuestions
                .filter((_, idx) => idx !== qIdx)
                .map((q, idx) => ({ ...q, id: idx + 1 }));
            setEditQuestions(updated);
        }
    };

    const handleSaveEditedExam = async () => {
        const effectiveSubject = editingExam.type === 'UAT' ? (editingExam.subject || 'UAT') : editingExam.subject;

        if (!editingExam.title || (editingExam.type !== 'UAT' && !editingExam.subject) || editQuestions.length === 0) {
            alert("Exam must have a title, subject, and at least one question.");
            return;
        }

        setIsUpdatingExam(true);
        const updatedExamData = {
            ...editingExam,
            subject: effectiveSubject,
            durationMinutes: Number(editingExam.durationMinutes),
            questions: editQuestions,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await db.collection('exams').doc(editingExam.id).set(updatedExamData, { merge: true });
            setExams(prev => prev.map(e => e.id === editingExam.id ? updatedExamData : e));
            setEditingExam(null);
            alert("Exam updated successfully!");
        } catch (err) {
            console.error("Error updating exam:", err);
            alert("Failed to update exam.");
        } finally {
            setIsUpdatingExam(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!examToDelete) return;
        setIsDeleting(true);
        try {
            await db.collection('exams').doc(examToDelete.id).delete();

            // 1. Remove history logs for deleted exam
            setExamHistory(prev => {
                const updated = { ...prev };
                delete updated[examToDelete.id];
                try { localStorage.setItem('exam_history_logs', JSON.stringify(updated)); } catch (e) { }
                return updated;
            });

            // 2. Remove high score for deleted exam
            setHighScores(prev => {
                const updated = { ...prev };
                delete updated[examToDelete.id];
                try { localStorage.setItem('exam_high_scores', JSON.stringify(updated)); } catch (e) { }
                return updated;
            });

            setExams(prev => prev.filter(e => e.id !== examToDelete.id));
            setExamToDelete(null);
        } catch (err) {
            console.error("Error deleting exam:", err);
            alert("Failed to delete exam from database.");
        } finally {
            setIsDeleting(false);
        }
    };
    const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const handleSelectExam = (exam) => {
    let shuffledQuestions = [...(exam.questions || [])];
    if (exam.type === 'UAT') {
        const englishPart = shuffleArray(shuffledQuestions.slice(0, 55));
        const mathPart = shuffleArray(shuffledQuestions.slice(55));
        shuffledQuestions = [...englishPart, ...mathPart];
    } else {
        shuffledQuestions = shuffleArray(shuffledQuestions);
    }

    setActiveExam({ ...exam, questions: shuffledQuestions });
    if (exam.type === 'UAT') {
            setUatSection('english');
            setInputHours(1);
            setInputMinutes(0);
            setInputSeconds(0);
            setTimeLeft(3600);
            setTimerStatus('running');
            setCurrentIndex(0);
        } else {
            setUatSection(null);
            const initialSeconds = exam.durationMinutes * 60;
            setInputHours(Math.floor(initialSeconds / 3600));
            setInputMinutes(Math.floor((initialSeconds % 3600) / 60));
            setInputSeconds(initialSeconds % 60);
            setTimeLeft(initialSeconds);
            setTimerStatus('running');
            setCurrentIndex(0);
        }
        setCurrentView('exam');
    };

    const startTimer = () => {
        const customTime = (inputHours * 3600) + (inputMinutes * 60) + inputSeconds;
        setTimeLeft(customTime > 0 ? customTime : 3600);
        setTimerStatus('running');
    };

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleOptionSelect = (questionId, optionId) => {
        if (currentView === 'results') return;
        setAnswers({ ...answers, [questionId]: optionId });
    };

    const toggleFlag = (questionId) => setFlagged({ ...flagged, [questionId]: !flagged[questionId] });

    const handleStartMath = () => {
        setUatSection('math');
        setCurrentIndex(55);
        setTimeLeft(5400);
        setInputHours(1);
        setInputMinutes(30);
        setInputSeconds(0);
        setTimerStatus('running');
    };

    const handleSubmit = () => {
        let finalScore = 0;
        activeExam.questions.forEach(q => {
            if (answers[q.id] === q.correctAnswer) finalScore++;
        });
        setScore(finalScore);

        const totalQ = activeExam.questions.length || 1;
        const scorePct = Math.round((finalScore / totalQ) * 100);

        setHighScores(prev => {
            const previousHigh = prev[activeExam.id] !== undefined ? prev[activeExam.id] : -1;
            const newHigh = Math.max(previousHigh, scorePct);
            const updated = { ...prev, [activeExam.id]: newHigh };
            try {
                localStorage.setItem('exam_high_scores', JSON.stringify(updated));
            } catch (e) { }
            return updated;
        });

        const newRecord = {
            score: finalScore,
            total: totalQ,
            scorePct: scorePct,
            date: new Date().toISOString()
        };

        setExamHistory(prev => {
            const updated = { ...prev };
            if (!updated[activeExam.id]) updated[activeExam.id] = [];
            updated[activeExam.id].push(newRecord);
            try {
                localStorage.setItem('exam_history_logs', JSON.stringify(updated));
            } catch (e) { }
            return updated;
        });

        localStorage.removeItem('exam_in_progress');

        setCurrentView('results');
        setTimerStatus('finished');
    };

    const handleReset = () => {
        setAnswers({});
        setFlagged({});
        setFlagReasons({});
        setScore(0);
        setCurrentIndex(0);
        setShowResetModal(false);
        setTimerStatus('running');

        if (activeExam.type === 'UAT') {
            setUatSection('english');
            setTimeLeft(3600);
            setInputHours(1);
            setInputMinutes(0);
            setInputSeconds(0);
        } else {
            setUatSection(null);
            const initialSeconds = activeExam.durationMinutes * 60;
            setTimeLeft(initialSeconds);
            setInputHours(Math.floor(initialSeconds / 3600));
            setInputMinutes(Math.floor((initialSeconds % 3600) / 60));
            setInputSeconds(initialSeconds % 60);
        }

        setCurrentView('exam');
    };

    const handleDeleteTrial = (examId, trialDate) => {
        if (!window.confirm("Are you sure you want to delete this trial record?")) return;

        setExamHistory(prev => {
            const updated = { ...prev };
            if (updated[examId]) {
                updated[examId] = updated[examId].filter(t => t.date !== trialDate);
                if (updated[examId].length === 0) {
                    delete updated[examId];
                }
            }
            try { localStorage.setItem('exam_history_logs', JSON.stringify(updated)); } catch (e) { }

            setHighScores(prevScores => {
                const updatedScores = { ...prevScores };
                if (!updated[examId] || updated[examId].length === 0) {
                    delete updatedScores[examId];
                } else {
                    updatedScores[examId] = Math.max(...updated[examId].map(t => t.scorePct));
                }
                try { localStorage.setItem('exam_high_scores', JSON.stringify(updatedScores)); } catch (e) { }
                return updatedScores;
            });

            return updated;
        });
    };

    const handleClearAllTrials = (examId) => {
        if (!window.confirm("Are you sure you want to delete ALL trial history for this exam?")) return;

        setExamHistory(prev => {
            const updated = { ...prev };
            delete updated[examId];
            try { localStorage.setItem('exam_history_logs', JSON.stringify(updated)); } catch (e) { }
            return updated;
        });

        setHighScores(prev => {
            const updated = { ...prev };
            delete updated[examId];
            try { localStorage.setItem('exam_high_scores', JSON.stringify(updated)); } catch (e) { }
            return updated;
        });
    };

    const exitToDashboard = () => {
        setActiveExam(null);
        setAnswers({});
        setFlagged({});
        setFlagReasons({});
        setScore(0);
        setCurrentIndex(0);
        setTimerStatus('idle');
        setUatSection(null);

        localStorage.removeItem('exam_in_progress');

        setCurrentView('dashboard');
    };

    const handleBackToDashboardClick = () => {
        if (currentView === 'exam') {
            setShowExitConfirmModal(true);
        } else {
            exitToDashboard();
        }
    };

    const handleConfirmExitAndSubmit = () => {
        handleSubmit();
        setShowExitConfirmModal(false);
        exitToDashboard();
    };

    const openExportModal = () => {
        const initialSelected = new Set();
        activeExam.questions.forEach(q => {
            if (answers[q.id] !== q.correctAnswer || flagged[q.id]) {
                initialSelected.add(q.id);
            }
        });
        setExportSelectedIds(initialSelected);
        setCopySuccess(false);
        setShowExportModal(true);
    };

    const toggleExportSelection = (id) => {
        const newSet = new Set(exportSelectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExportSelectedIds(newSet);
    };

    const convertHtmlToText = (htmlStr) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlStr;
        return tempDiv.textContent || tempDiv.innerText || '';
    };

    const handleCopyForAI = () => {
        let exportText = `I need help understanding my mistakes on the ${activeExam.title}.\n\n`;
        const sortedIds = [...exportSelectedIds].sort((a, b) => a - b);
        const includedPassages = new Set();

        sortedIds.forEach(id => {
            const q = activeExam.questions.find(item => item.id === id);
            if (q.passageTitle && q.passage && !includedPassages.has(q.passageTitle)) {
                includedPassages.add(q.passageTitle);
                const cleanPassageText = q.isHTML ? convertHtmlToText(q.passage) : q.passage;
                exportText += `===================================================\nREFERENCE DATA: ${q.passageTitle}\n===================================================\n${cleanPassageText}\n===================================================\n\n`;
            }
            exportText += `--- Question ${q.id} ---\n`;
            if (flagged[q.id]) {
                exportText += `[Flagged by User]\n`;
                if (flagReasons[q.id]) exportText += `User's reason for flagging: ${flagReasons[q.id].trim()}\n`;
            }
            exportText += `Question: ${q.text}\n`;
            q.options.forEach(opt => { exportText += `${opt.id}) ${opt.text}\n`; });
            const myAnsId = answers[q.id];
            const myAnsText = myAnsId ? q.options.find(o => o.id === myAnsId)?.text : "None Selected";
            exportText += `\nMy Selected Answer: ${myAnsId ? myAnsId + ') ' + myAnsText : 'None Selected'}\n`;
            exportText += `Correct Answer: ${q.correctAnswer}) ${q.options.find(o => o.id === q.correctAnswer)?.text}\n\n`;
        });

        const textArea = document.createElement("textarea");
        textArea.value = exportText;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            if (document.execCommand('copy')) {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            }
        } catch (err) { }
        document.body.removeChild(textArea);
    };

    const renderBlockGroup = (blocksList, sectionType) => {
        let sectionTitle = "Question Blocks & Extendable Passages";
        if (sectionType === 'english') sectionTitle = "English Section (Questions 1-55)";
        if (sectionType === 'math') sectionTitle = "Math Section (Questions 56-100)";

        return (
            <div className={sectionType !== 'default' ? "mt-6 border-t pt-4" : ""}>
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wide">{sectionTitle}</h4>
                </div>
                <div className="space-y-6">
                    {blocksList.map((block, bIdx) => (
                        <div key={block.id} className="border-2 border-blue-100 rounded-xl bg-white p-4 shadow-sm space-y-4 relative">
                            <div className="flex flex-wrap justify-between items-center bg-blue-50/70 p-3 rounded-lg border border-blue-200 gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-blue-900 text-sm">Block {bIdx + 1}</span>
                                    <span className="text-xs text-blue-700 font-semibold bg-blue-100 px-2.5 py-1 rounded-full border border-blue-200">
                                        Questions {block.startQ} to {block.endQ}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <span className="text-gray-600 font-semibold">End Question #:</span>
                                        <input
                                            type="number"
                                            value={block.endQ}
                                            min={block.startQ}
                                            max={sectionType === 'english' ? 55 : (sectionType === 'math' ? 100 : undefined)} onChange={(e) => handleUpdateBlock(bIdx, 'endQ', e.target.value, sectionType)}
                                            className="w-16 border border-gray-300 rounded p-1 text-xs font-bold text-center focus:ring-1 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    {blocksList.length > 1 && (
                                        <button onClick={() => handleRemoveBlock(bIdx, sectionType)} className="text-red-500 hover:text-red-700 text-xs font-bold pl-2 border-l border-gray-300">
                                            Remove Block
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-gray-800">
                                        Extendable Reference / Passage / Table
                                    </label>
                                    <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={block.isHTML}
                                            onChange={(e) => handleUpdateBlock(bIdx, 'isHTML', e.target.checked, sectionType)}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        <span>Render as HTML / Table</span>
                                    </label>
                                </div>
                                <input
                                    type="text"
                                    value={block.passageTitle}
                                    onChange={(e) => handleUpdateBlock(bIdx, 'passageTitle', e.target.value, sectionType)}
                                    placeholder="Passage Title (e.g., Reading Passage 1, Data Table 1)"
                                    className="w-full border border-gray-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                                <textarea
                                    value={block.passage}
                                    onChange={(e) => handleUpdateBlock(bIdx, 'passage', e.target.value, sectionType)}
                                    rows="3"
                                    placeholder="Paste Passage text or HTML table code here..."
                                    className="w-full border border-gray-300 rounded p-2 text-xs font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                                ></textarea>
                                <ImageUploadZone
                                    currentImage={block.blockImage}
                                    onUploadSuccess={(url) => handleUpdateBlock(bIdx, 'blockImage', url, sectionType)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Questions Input for Block {bIdx + 1} (Questions {block.startQ} to {block.endQ})
                                </label>
                                <textarea
                                    value={block.rawText}
                                    onChange={(e) => handleUpdateBlock(bIdx, 'rawText', e.target.value, sectionType)}
                                    rows="6"
                                    placeholder={`1. What is the main idea?\nA) Option A\nB) Option B\nC) Option C\nD) Option D\nAnswer: B\nExplanation: Simple explanation.`}
                                    className="w-full border border-gray-300 rounded-lg p-3 font-mono text-xs text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                ></textarea>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={() => handleAddBlock(sectionType)}
                    className="mt-4 w-full py-2.5 border-2 border-dashed border-blue-400 hover:border-blue-600 bg-blue-50/50 hover:bg-blue-100/50 text-blue-800 text-xs font-bold rounded-xl transition-colors flex justify-center items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    Add Another Block
                </button>
            </div>
        );
    };

    const availableSubjects = ['All', ...new Set(exams.map(e => e.subject).filter(Boolean))];
    const filteredExams = exams.filter(exam => {
        const matchesSearch = exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (exam.description && exam.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (exam.subject && exam.subject.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesSubject = selectedSubjectFilter === 'All' || exam.subject === selectedSubjectFilter;
        return matchesSearch && matchesSubject;
    });

    const getExamGradeStyling = (scorePct) => {
        if (scorePct === undefined || scorePct === null || scorePct === -1) {
            return {
                cardBg: "bg-white border-gray-200 hover:border-gray-300",
                badgeClass: "bg-gray-100 text-gray-600 border-gray-200 inline-block px-2 py-0.5 rounded-md text-[10px] border",
                label: null
            };
        }

        const baseClass = "font-bold inline-block px-2 py-0.5 rounded-md text-[10px] border relative z-10 text-center min-w-[90px]";

        if (scorePct === 100) {
            return {
                cardBg: "bg-yellow-100/90 border-yellow-400 hover:border-yellow-500 shadow-md",
                badgeClass: `text-yellow-900 border-yellow-500 font-bold ${baseClass}`,
                label: `👑 100%`,
                gradient: `linear-gradient(to right, #facc15 ${scorePct}%, #fefce8 ${scorePct}%)`
            };
        } else if (scorePct >= 95) {
            return {
                cardBg: "bg-emerald-50/80 border-emerald-300 hover:border-emerald-400 shadow-sm",
                badgeClass: `text-emerald-900 border-emerald-400 ${baseClass}`,
                label: `${scorePct}%`,
                gradient: `linear-gradient(to right, #6ee7b7 ${scorePct}%, #ecfdf5 ${scorePct}%)`
            };
        } else if (scorePct >= 90) {
            return {
                cardBg: "bg-amber-50/80 border-amber-300 hover:border-amber-400 shadow-sm",
                badgeClass: `text-amber-900 border-amber-400 ${baseClass}`,
                label: `${scorePct}%`,
                gradient: `linear-gradient(to right, #fcd34d ${scorePct}%, #fffbeb ${scorePct}%)`
            };
        } else {
            return {
                cardBg: "bg-rose-50/80 border-rose-300 hover:border-rose-400 shadow-sm",
                badgeClass: `text-rose-900 border-rose-400 ${baseClass}`,
                label: `${scorePct}%`,
                gradient: `linear-gradient(to right, #fca5a5 ${scorePct}%, #fff1f2 ${scorePct}%)`
            };
        }
    };
    const allAvailableSubjects = Array.from(new Set([...customSubjects, ...exams.map(e => e.subject).filter(Boolean)]));

    if (currentView === 'dashboard') {
        return (
            <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto">
                    <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-5">
                        <div>
                            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Assessments Dashboard</h1>
                            <p className="mt-1 text-sm text-gray-500">Manage exams, search questions, or start practice tests.</p>
                        </div>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition-colors shrink-0 text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                            Add Exam
                        </button>
                    </header>

                    <div className="mb-6 bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
                        <div className="relative w-full sm:flex-1">
                            <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search exams by title, topic, or subject..."
                                className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <label className="text-xs font-semibold text-gray-600 shrink-0">Filter Subject:</label>
                            <select
                                value={selectedSubjectFilter}
                                onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                                className="w-full sm:w-auto border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {availableSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                            </select>
                        </div>
                    </div>

                    {loadingExams ? (
                        <div className="text-center py-12 text-gray-500">Loading exams from Firestore...</div>
                    ) : filteredExams.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 p-8">
                            <p className="text-gray-500 mb-4">No matching exams found.</p>
                            <button onClick={() => { setSearchQuery(''); setSelectedSubjectFilter('All'); }} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300">Clear Search Filters</button>
                        </div>
                    ) : (
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                            {filteredExams.map((exam) => {
                                const topScorePct = highScores[exam.id];
                                const styling = getExamGradeStyling(topScorePct);

                                return (
                                    <div
                                        key={exam.id}
                                        className={`rounded-xl border transition-all duration-200 flex flex-col justify-between p-3.5 relative group aspect-[2/1] min-h-[105px] ${styling.cardBg}`}
                                    >
                                        <div className="flex flex-wrap justify-between items-start gap-2 mb-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                {exam.subject && (exam.type !== 'UAT' || exam.subject.toUpperCase() !== 'UAT') && (
                                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-blue-100 text-blue-800 uppercase border border-blue-200">
                                                        {exam.subject}
                                                    </span>
                                                )}
                                                {exam.type === 'UAT' && (
                                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-purple-100 text-purple-800 uppercase border border-purple-200">
                                                        UAT
                                                    </span>
                                                )}
                                                {styling.label && (
                                                    <span
                                                        className={styling.badgeClass}
                                                        title="Highest Score Percentage"
                                                        style={{ background: styling.gradient }}
                                                    >
                                                        Score: {styling.label}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button onClick={() => setSelectedExamStats(exam)} title="Exam Info & History" className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                </button>
                                                <button onClick={() => handleOpenEditModal(exam)} title="Edit Exam" className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                                </button>
                                                <button onClick={() => setExamToDelete(exam)} title="Delete Exam Set" className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="my-auto pr-1">
                                            <h3 className="text-base font-bold text-gray-900 leading-tight truncate">{exam.title}</h3>
                                            <p className="text-gray-600 text-xs line-clamp-1 mt-0.5">{exam.description || 'No description provided.'}</p>
                                        </div>

                                        <div className="border-t border-gray-200/60 pt-2 flex items-center justify-between mt-1">
                                            <div className="text-xs font-medium text-gray-600 flex items-center gap-1">
                                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                {exam.durationMinutes} mins • {exam.questions?.length || 0} Qs
                                            </div>
                                            <button onClick={() => handleSelectExam(exam)} className="px-3.5 py-1 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-md transition-colors shadow-sm">
                                                Start Exam
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* EXAM INFO & HISTORY MODAL */}
                    {selectedExamStats && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
                            <div className="bg-white rounded-xl shadow-2xl flex flex-col max-w-2xl w-full max-h-[90vh] overflow-hidden">
                                <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                    <h3 className="text-xl font-bold text-gray-900">Exam Info & History</h3>
                                    <button onClick={() => setSelectedExamStats(null)} className="text-gray-400 hover:text-gray-700">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                </div>
                                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                                    <div>
                                        <h4 className="text-lg font-bold text-gray-800">{selectedExamStats.title}</h4>
                                        <p className="text-sm text-gray-600 mt-1">{selectedExamStats.description || 'No description provided.'}</p>
                                        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                                            <div><span className="font-semibold text-gray-700">Subject:</span> {selectedExamStats.subject}</div>
                                            <div><span className="font-semibold text-gray-700">Duration:</span> {selectedExamStats.durationMinutes} mins</div>
                                            <div><span className="font-semibold text-gray-700">Total Questions:</span> {selectedExamStats.questions?.length || 0}</div>
                                            <div><span className="font-semibold text-gray-700">Type:</span> {selectedExamStats.type}</div>
                                        </div>
                                    </div>
                                    <div className="border-t pt-4">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-bold text-gray-800">Trial History</h4>
                                            {examHistory[selectedExamStats.id] && examHistory[selectedExamStats.id].length > 0 && (
                                                <button
                                                    onClick={() => handleClearAllTrials(selectedExamStats.id)}
                                                    className="text-xs px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-800 font-semibold rounded border border-red-200 transition-colors"
                                                >
                                                    Clear All History
                                                </button>
                                            )}
                                        </div>

                                        {(!examHistory[selectedExamStats.id] || examHistory[selectedExamStats.id].length === 0) ? (
                                            <p className="text-sm text-gray-500">No trials recorded yet.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="text-sm font-semibold text-gray-600 mb-2">Total Trials: {examHistory[selectedExamStats.id].length}</div>
                                                <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                                                    <table className="min-w-full divide-y divide-gray-200">
                                                        <thead className="bg-gray-100">
                                                            <tr>
                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white divide-y divide-gray-200">
                                                            {[...examHistory[selectedExamStats.id]]
                                                                .sort((a, b) => b.scorePct - a.scorePct)
                                                                .map((trial, idx) => (
                                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{new Date(trial.date).toLocaleString()}</td>
                                                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{trial.score} / {trial.total}</td>
                                                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{trial.scorePct}%</td>
                                                                        <td className="px-4 py-2 whitespace-nowrap text-right text-sm">
                                                                            <button
                                                                                onClick={() => handleDeleteTrial(selectedExamStats.id, trial.date)}
                                                                                className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                                                                title="Delete Trial"
                                                                            >
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                                                                </svg>
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 border-t bg-gray-50 flex justify-end">
                                    <button onClick={() => setSelectedExamStats(null)} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800">Close</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODAL: ADD NEW EXAM */}
                    {showAddModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
                            <div className="bg-white rounded-xl shadow-2xl flex flex-col max-w-5xl w-full max-h-[92vh] overflow-hidden">
                                <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">Add New Exam (Block Builder)</h3>
                                        <p className="text-xs text-gray-500 mt-0.5">Configure exam details and organize questions into extendable passage blocks.</p>
                                    </div>
                                    <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                </div>

                                <div className="p-6 overflow-y-auto flex-1">
                                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Exam Title *</label>
                                            <input type="text" value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="e.g. Model Exam 2" className="w-full border border-gray-300 rounded-md p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Exam Type</label>
                                            <select
                                                value={examType}
                                                onChange={(e) => {
                                                    const selectedType = e.target.value;
                                                    setExamType(selectedType);
                                                    if (selectedType === 'UAT') {
                                                        setExamSubject('UAT');
                                                    }
                                                }}
                                                className="w-full border border-gray-300 rounded-md p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                            >
                                                <option value="default">Default</option>
                                                <option value="UAT">UAT</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                                Subject {examType === 'UAT' ? '(Auto: UAT)' : '*'}
                                            </label>
                                            <div className="flex gap-1">
                                                <select
                                                    value={examType === 'UAT' ? (examSubject || 'UAT') : examSubject}
                                                    onChange={(e) => setExamSubject(e.target.value)}
                                                    disabled={examType === 'UAT'}
                                                    className={`w-full border border-gray-300 rounded-md p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white ${examType === 'UAT' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                                                >
                                                    <option value="" disabled>Select...</option>
                                                    {allAvailableSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                                                </select>
                                                {examType !== 'UAT' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newSub = window.prompt("Enter new subject name:");
                                                            if (newSub && newSub.trim()) {
                                                                setCustomSubjects(prev => [...prev, newSub.trim()]);
                                                                setExamSubject(newSub.trim());
                                                            }
                                                        }}
                                                        className="px-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold rounded border border-blue-200 text-xs"
                                                    >+</button>
                                                )}
                                            </div>
                                        </div>
                                        {examType !== 'UAT' && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Duration (Mins)</label>
                                                    <input type="number" value={examDuration} onChange={(e) => setExamDuration(e.target.value)} min="1" className="w-full border border-gray-300 rounded-md p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
                                                </div>
                                            </>
                                        )}
                                        <div className="md:col-span-3 lg:col-span-5">
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                                            <input type="text" value={examDescription} onChange={(e) => setExamDescription(e.target.value)} placeholder="Brief details or instructions..." className="w-full border border-gray-300 rounded-md p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                    </div>

                                    {examType === 'UAT' ? (
                                        <div className="border-t pt-4">
                                            {renderBlockGroup(uatEnglishBlocks, 'english')}
                                            {renderBlockGroup(uatMathBlocks, 'math')}
                                        </div>
                                    ) : (
                                        <div className="border-t pt-4">
                                            {renderBlockGroup(examBlocks, 'default')}
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                                    <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-md text-gray-700 text-sm font-medium hover:bg-gray-100">Cancel</button>
                                    <button
                                        onClick={handleSaveExamToFirestore}
                                        disabled={isSavingExam}
                                        className={`px-6 py-2 text-white text-sm font-bold rounded-md shadow transition-colors ${isSavingExam ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                                    >
                                        {isSavingExam ? 'Saving Exam...' : 'Save & Publish Exam'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODAL: EDIT EXISTING EXAM */}
                    {editingExam && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
                            <div className="bg-white rounded-xl shadow-2xl flex flex-col max-w-4xl w-full max-h-[90vh] overflow-hidden">
                                <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                    <h3 className="text-xl font-bold text-gray-900">Edit Exam & Questions</h3>
                                    <button onClick={() => setEditingExam(null)} className="text-gray-400 hover:text-gray-700">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                </div>

                                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                                            <input type="text" value={editingExam.title} onChange={(e) => setEditingExam({ ...editingExam, title: e.target.value })} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">Exam Type</label>
                                            <select
                                                value={editingExam.type || 'default'}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setEditingExam({
                                                        ...editingExam,
                                                        type: val,
                                                        subject: val === 'UAT' && !editingExam.subject ? 'UAT' : editingExam.subject
                                                    });
                                                }}
                                                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                            >
                                                <option value="default">Default</option>
                                                <option value="UAT">UAT</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                Subject {editingExam.type === 'UAT' ? '(Auto: UAT)' : ''}
                                            </label>
                                            <input
                                                type="text"
                                                value={editingExam.type === 'UAT' ? (editingExam.subject || 'UAT') : editingExam.subject}
                                                onChange={(e) => setEditingExam({ ...editingExam, subject: e.target.value })}
                                                disabled={editingExam.type === 'UAT'}
                                                className={`w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${editingExam.type === 'UAT' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">Duration (Mins)</label>
                                            <input type="number" value={editingExam.durationMinutes} onChange={(e) => setEditingExam({ ...editingExam, durationMinutes: e.target.value })} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                                        <textarea value={editingExam.description || ''} onChange={(e) => setEditingExam({ ...editingExam, description: e.target.value })} rows="2" className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
                                    </div>

                                    <div className="border-t pt-4">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="font-bold text-gray-900 text-base">Questions ({editQuestions.length})</h4>
                                            <button onClick={handleAddQuestionToEdit} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded flex items-center gap-1">
                                                + Add Question
                                            </button>
                                        </div>

                                        <div className="space-y-6 max-h-[40vh] overflow-y-auto pr-2">
                                            {editQuestions.map((q, qIdx) => (
                                                <div key={qIdx} className="p-4 border rounded-lg bg-gray-50 space-y-3 relative">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-gray-800 text-sm">Question {qIdx + 1}</span>
                                                        <button onClick={() => handleDeleteQuestionFromEdit(qIdx)} className="text-red-500 hover:text-red-700 text-xs font-semibold">
                                                            Delete Question
                                                        </button>
                                                    </div>

                                                    <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-md space-y-2">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-bold text-blue-900">Extendable Reading Passage / Table</span>
                                                            <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={q.isHTML || false}
                                                                    onChange={(e) => handleUpdateQuestionField(qIdx, 'isHTML', e.target.checked)}
                                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span>Render as HTML / Table</span>
                                                            </label>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={q.passageTitle || ''}
                                                            onChange={(e) => handleUpdateQuestionField(qIdx, 'passageTitle', e.target.value)}
                                                            placeholder="Passage Title (e.g., Passage 1, Cloze Test, Table 1)"
                                                            className="w-full border border-gray-300 rounded p-1.5 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                        />
                                                        <textarea
                                                            value={q.passage || ''}
                                                            onChange={(e) => handleUpdateQuestionField(qIdx, 'passage', e.target.value)}
                                                            rows="3"
                                                            placeholder="Paste Passage text or HTML table code here..."
                                                            className="w-full border border-gray-300 rounded p-1.5 text-xs bg-white font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                                                        ></textarea>
                                                    </div>

                                                    <textarea
                                                        value={q.text}
                                                        onChange={(e) => handleUpdateQuestionField(qIdx, 'text', e.target.value)}
                                                        rows="2"
                                                        className="w-full border border-gray-300 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                        placeholder="Question Stem Text..."
                                                    ></textarea>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {q.options.map((opt, optIdx) => (
                                                            <div key={opt.id} className="flex items-center gap-2 bg-white p-1.5 border rounded">
                                                                <span className="font-bold text-xs text-gray-600 w-4">{opt.id}.</span>
                                                                <input
                                                                    type="text"
                                                                    value={opt.text}
                                                                    onChange={(e) => handleUpdateOptionText(qIdx, optIdx, e.target.value)}
                                                                    className="w-full text-xs border-none outline-none"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="flex items-center gap-3 pt-1">
                                                        <label className="text-xs font-semibold text-gray-700">Correct Answer:</label>
                                                        <select
                                                            value={q.correctAnswer}
                                                            onChange={(e) => handleUpdateQuestionField(qIdx, 'correctAnswer', e.target.value)}
                                                            className="border rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                        >
                                                            {q.options.map(o => <option key={o.id} value={o.id}>{o.id}</option>)}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Explanation:</label>
                                                        <textarea
                                                            value={q.explanation || ''}
                                                            onChange={(e) => handleUpdateQuestionField(qIdx, 'explanation', e.target.value)}
                                                            rows="2"
                                                            className="w-full border border-gray-300 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                            placeholder="Explanation for the correct answer..."
                                                        ></textarea>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                                    <button onClick={() => setEditingExam(null)} className="px-4 py-2 border rounded-md text-gray-700 text-sm font-medium hover:bg-gray-100">Cancel</button>
                                    <button
                                        onClick={handleSaveEditedExam}
                                        disabled={isUpdatingExam}
                                        className={`px-5 py-2 text-white text-sm font-bold rounded-md shadow transition-colors ${isUpdatingExam ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                                    >
                                        {isUpdatingExam ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODAL: DELETE CONFIRMATION */}
                    {examToDelete && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Entire Exam Set?</h3>
                                <p className="text-sm text-gray-600 mb-6">
                                    Are you sure you want to delete <span className="font-bold text-gray-900">"{examToDelete.title}"</span>? This action cannot be undone.
                                </p>
                                <div className="flex justify-end gap-3">
                                    <button onClick={() => setExamToDelete(null)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium">Cancel</button>
                                    <button
                                        onClick={handleConfirmDelete}
                                        disabled={isDeleting}
                                        className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md text-sm font-medium"
                                    >
                                        {isDeleting ? 'Deleting...' : 'Delete Exam'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const isSubmitted = currentView === 'results';
    const question = activeExam.questions[currentIndex] || activeExam.questions[0];

    const renderQuestionButton = (q, idx) => {
        const isAnswered = !!answers[q.id];
        const isFlagged = !!flagged[q.id];
        const isActive = currentIndex === idx;
        let bgClass = "bg-white text-gray-600 border-gray-300 hover:bg-gray-50";

        if (isSubmitted) {
            if (!answers[q.id]) bgClass = "bg-gray-100 text-gray-500 border-gray-300";
            else if (answers[q.id] === q.correctAnswer) bgClass = "bg-green-100 text-green-800 border-green-400";
            else bgClass = "bg-red-100 text-red-800 border-red-400";
        } else if (isAnswered) bgClass = "bg-blue-100 text-blue-800 border-blue-300";

        return (
            <button onClick={() => setCurrentIndex(idx)} key={q.id} className={`relative flex items-center justify-center py-2 px-1 text-xs sm:text-sm font-medium rounded border transition-colors ${bgClass} ${isActive ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}>
                {idx + 1}
                {isFlagged && <div className="absolute top-0 right-0 w-0 h-0 border-t-[10px] border-l-[10px] border-t-red-500 border-l-transparent rounded-tr-[3px]"></div>}
            </button>
        );
    };

    let englishScore = 0;
    let mathScore = 0;
    if (isSubmitted && activeExam.type === 'UAT') {
        activeExam.questions.forEach((q, idx) => {
            if (answers[q.id] === q.correctAnswer) {
                if (idx < 55) englishScore++;
                else mathScore++;
            }
        });
    }

    let isPrevDisabled = false;
    let isNextDisabled = false;
    if (activeExam?.type === 'UAT' && !isSubmitted) {
        if (uatSection === 'english') {
            isPrevDisabled = currentIndex === 0;
            isNextDisabled = currentIndex === 54;
        } else if (uatSection === 'math') {
            isPrevDisabled = currentIndex === 55;
            isNextDisabled = currentIndex === activeExam.questions.length - 1;
        }
    } else {
        isPrevDisabled = currentIndex === 0;
        isNextDisabled = currentIndex === activeExam.questions.length - 1;
    }

    const finalScorePct = activeExam?.questions?.length ? Math.round((score / activeExam.questions.length) * 100) : 0;

    const scoreColorClass = finalScorePct === 100 ? "text-yellow-500" : finalScorePct >= 95 ? "text-emerald-600" : finalScorePct >= 90 ? "text-amber-500" : "text-rose-600";

    const displayScoreText = finalScorePct === 100 ? (
        <span><span className="animate-crown">👑</span> 100%</span>
    ) : `${finalScorePct}%`;

    // The return statement and main container were missing here!
    return (
        <div className="min-h-screen py-4 px-4 sm:px-6 lg:px-8 relative pb-20">

            {/* The celebration overlay */}
            {isSubmitted && finalScorePct === 100 && (
                <div className="fixed inset-0 pointer-events-none z-50 animate-cyan-bg"></div>
            )}

            {showResetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Retake Exam?</h3>
                        <p className="text-gray-600 mb-6">Are you sure you want to retake the entire exam? All progress will be lost.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowResetModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium">Cancel</button>
                            <button onClick={handleReset} className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md font-medium">Yes, Retake</button>
                        </div>
                    </div>
                </div>
            )}

            {showExitConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Submit & Exit?</h3>
                        <p className="text-gray-600 text-sm mb-6">Returning to the dashboard will submit your exam right away and record your score. Are you sure?</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowExitConfirmModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium">Cancel</button>
                            <button onClick={handleConfirmExitAndSubmit} className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md text-sm font-medium">Yes, Submit & Exit</button>
                        </div>
                    </div>
                </div>
            )}

            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 transition-opacity p-4">
                    <div className="bg-white rounded-lg shadow-2xl flex flex-col max-w-3xl w-full max-h-[90vh]">
                        <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">Export for AI Agent</h3>
                            <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-700"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                        </div>
                        <div className="p-5 overflow-y-auto flex-1 bg-white">
                            <div className="space-y-3">
                                {activeExam.questions.map(q => {
                                    const isSelected = exportSelectedIds.has(q.id);
                                    const isWrong = answers[q.id] !== q.correctAnswer;
                                    const isFlagged = flagged[q.id];
                                    return (
                                        <label key={q.id} className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-gray-200'}`}>
                                            <input type="checkbox" checked={isSelected} onChange={() => toggleExportSelection(q.id)} className="w-5 h-5 mt-0.5 text-blue-600 rounded border-gray-300" />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className="font-bold text-gray-900">Question {q.id}</span>
                                                    {isWrong && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">Incorrect</span>}
                                                    {isFlagged && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">Flagged</span>}
                                                </div>
                                                <div className="text-sm text-gray-700 line-clamp-2"><MathText text={q.text} /></div>
                                            </div>
                                        </label>
                                    )
                                })}
                            </div>
                        </div>
                        <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-between items-center rounded-b-lg">
                            <span className="text-sm font-medium text-gray-600">Selected: {exportSelectedIds.size}</span>
                            <div className="flex gap-3">
                                <button onClick={handleCopyForAI} className={`px-5 py-2.5 text-white rounded-lg font-medium flex items-center gap-2 ${copySuccess ? 'bg-green-600' : 'bg-purple-600 hover:bg-purple-700'}`}>
                                    {copySuccess ? 'Copied!' : 'Copy to Clipboard'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto">
                <div className="mb-4">
                    <button onClick={handleBackToDashboardClick} className="text-sm font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        Back to Dashboard
                    </button>
                </div>

                <div className="fixed bottom-6 right-6 sm:top-6 sm:right-8 sm:bottom-auto z-40 flex-shrink-0">
                    {isTimerHidden ? (
                        <button onClick={() => setIsTimerHidden(false)} className="flex items-center justify-center w-10 h-10 bg-white text-gray-400 rounded-full shadow-md border border-gray-200">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </button>
                    ) : (
                        <div className="bg-white rounded-full border border-gray-200 shadow-md py-1.5 px-3 flex items-center gap-3">
                            <button onClick={() => setIsTimerHidden(true)} className="text-gray-400 hover:text-gray-700"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                            {timerStatus === 'idle' && !isSubmitted ? (
                                <div className="flex items-center text-sm font-mono text-gray-700 font-medium">
                                    <select value={inputHours} onChange={(e) => setInputHours(Number(e.target.value))} className="appearance-none bg-transparent outline-none cursor-pointer text-center w-6 hover:text-blue-600 transition-colors">
                                        {[...Array(13).keys()].map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                                    </select><span>:</span>
                                    <select value={inputMinutes} onChange={(e) => setInputMinutes(Number(e.target.value))} className="appearance-none bg-transparent outline-none cursor-pointer text-center w-6 hover:text-blue-600 transition-colors">
                                        {[...Array(60).keys()].map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                                    </select><span>:</span>
                                    <select value={inputSeconds} onChange={(e) => setInputSeconds(Number(e.target.value))} className="appearance-none bg-transparent outline-none cursor-pointer text-center w-6 hover:text-blue-600 transition-colors">
                                        {[...Array(60).keys()].map(s => <option key={s} value={s}>{String(s).padStart(2, '0')}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div className={`font-mono font-bold text-base tracking-wider ${timeLeft <= 300 && timerStatus === 'running' ? 'text-red-600 animate-pulse' : 'text-gray-800'}`}>
                                    {formatTime(timeLeft)}
                                </div>
                            )}
                            {!isSubmitted && (
                                <div className="flex items-center pl-1 border-l border-gray-200">
                                    {timerStatus === 'idle' && (
                                        <button onClick={startTimer} className="p-1 ml-1 rounded-full text-green-600 hover:bg-green-50"><svg className="w-5 h-5 fill-current" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg></button>
                                    )}
                                    {timerStatus === 'running' && (
                                        <button onClick={() => setTimerStatus('paused')} className="p-1 ml-1 rounded-full text-amber-500 hover:bg-amber-50">
                                            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
                                            </svg>
                                        </button>
                                    )}
                                    {timerStatus === 'paused' && (
                                        <button onClick={() => setTimerStatus('running')} className="p-1 ml-1 rounded-full text-blue-500 hover:bg-blue-50"><svg className="w-5 h-5 fill-current" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg></button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <header className="mb-6 text-center mt-2 border-b border-gray-200 pb-4">
                    <h1 className="text-3xl sm:text-4xl font-bold text-[#111827] mb-2">{activeExam.title}</h1>
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">{activeExam.subject}</span>
                </header>
                <div className="flex flex-col lg:flex-row gap-6 relative">
                    <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-6 h-fit bg-white rounded-lg border border-gray-200 shadow-sm p-4 order-2 lg:order-1">
                        <h3 className="text-lg font-bold text-gray-900 mb-3 border-b pb-2">Questions</h3>
                        <div className="pr-2 pb-2 max-h-[300px] lg:max-h-[50vh] overflow-y-auto">
                            {activeExam.type === 'UAT' ? (
                                <>
                                    {(isSubmitted || uatSection === 'english') && (
                                        <>
                                            <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">English (1-55)</div>
                                            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-5 gap-2 mb-4">
                                                {activeExam.questions.slice(0, 55).map((q, idx) => renderQuestionButton(q, idx))}
                                            </div>
                                        </>
                                    )}
                                    {(isSubmitted || uatSection === 'math') && activeExam.questions.length > 55 && (
                                        <>
                                            <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide border-t border-gray-100 pt-3">Mathematics (56+)</div>
                                            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-5 gap-2 mb-2">
                                                {activeExam.questions.slice(55).map((q, idx) => renderQuestionButton(q, idx + 55))}
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : (
                                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-5 gap-2 mb-2">
                                    {activeExam.questions.map((q, idx) => renderQuestionButton(q, idx))}
                                </div>
                            )}
                        </div>

                        {!isSubmitted ? (
                            <div className="flex flex-col gap-3 mt-4 border-t pt-4">
                                {activeExam.type === 'UAT' ? (
                                    <div className="text-sm text-gray-600 mb-1">
                                        Answered: <span className="font-bold">
                                            {uatSection === 'english'
                                                ? activeExam.questions.slice(0, 55).filter(q => answers[q.id]).length
                                                : activeExam.questions.slice(55).filter(q => answers[q.id]).length}
                                        </span> / {uatSection === 'english' ? 55 : Math.max(0, activeExam.questions.length - 55)}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-600 mb-1">
                                        Answered: <span className="font-bold">{Object.keys(answers).length}</span> / {activeExam.questions.length}
                                    </div>
                                )}

                                {activeExam.type === 'UAT' && uatSection === 'english' ? (
                                    <button onClick={handleStartMath} className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm">
                                        Submit English & Start Math
                                    </button>
                                ) : (
                                    <button onClick={handleSubmit} className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm">
                                        Submit Exam
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 mt-4 pt-3 border-t border-gray-200">
                                {activeExam.type === 'UAT' ? (
                                    <>
                                        <div className="text-sm font-normal text-gray-900 flex justify-between">
                                            English Score: <span className="font-bold text-blue-600">{englishScore} / 55</span>
                                        </div>
                                        <div className="text-sm font-normal text-gray-900 flex justify-between">
                                            Math Score: <span className="font-bold text-purple-600">{mathScore} / {activeExam.questions.length > 55 ? activeExam.questions.length - 55 : 0}</span>
                                        </div>
                                        <div className="text-base font-bold text-gray-900 border-t pt-2 mt-1 flex justify-between">
                                            Total Score: <span className={scoreColorClass}>{score} / {activeExam.questions.length}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className={`text-4xl font-extrabold ${scoreColorClass}`}>
                                        {displayScoreText}
                                    </div>
                                )}
                                <div className="flex flex-col gap-2 mt-1">
                                    <button onClick={() => setShowResetModal(true)} className="w-full px-4 py-2 bg-white border border-gray-300 text-gray-800 font-medium text-sm rounded-lg hover:bg-gray-50 transition-colors">Retake Exam</button>
                                    <button onClick={openExportModal} className="w-full px-4 py-2 bg-purple-100 text-purple-800 font-medium text-sm rounded-lg hover:bg-purple-200 transition-colors flex justify-center items-center gap-2">
                                        Export to AI
                                    </button>
                                </div>
                            </div>
                        )}
                    </aside>

                    <main className="flex-1 order-1 lg:order-2">
                        <div className="bg-[#f8f9fa] border border-gray-200 rounded-lg p-5 sm:p-8 shadow-sm min-h-[400px] flex flex-col justify-between">
                            <div>
                                {question.passage && (
                                    <Passage
                                        title={question.passageTitle}
                                        text={question.passage}
                                        isHTML={question.isHTML}
                                    />
                                )}
                                <div className="mb-5 flex justify-between items-start gap-4">
                                    <div className="w-full overflow-hidden">
                                        <h2 className="text-indigo-500 text-xs font-bold uppercase tracking-wider mb-2">
                                            {activeExam.type === 'UAT'
                                                ? (currentIndex < 55 ? `English Section - Question ${currentIndex + 1}` : `Mathematics Section - Question ${currentIndex + 1}`)
                                                : `Question ${currentIndex + 1}`
                                            }
                                        </h2>
                                        {question.image && <img src={question.image} alt="Figure" className="mb-4 max-w-full rounded-md border border-gray-200 mt-2 max-h-64 object-contain" />}
                                        <div className="text-gray-900 text-lg sm:text-xl whitespace-pre-wrap leading-relaxed">
                                            <span className="font-bold mr-2">{currentIndex + 1}.</span><MathText text={question.text} />
                                        </div>
                                    </div>
                                    <button onClick={() => toggleFlag(question.id)} className={`p-1.5 rounded-md transition-colors group ${flagged[question.id] ? "text-red-500 fill-red-500" : "text-gray-400 hover:text-gray-600 fill-none"}`}>
                                        <svg className="w-7 h-7" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                                    </button>
                                </div>

                                <div className="space-y-4 pl-0 sm:pl-6 transition-all duration-300">
                                    {question.options.map((option) => {
                                        const isSelected = answers[question.id] === option.id;
                                        const isCorrect = option.id === question.correctAnswer;
                                        let labelClass = "flex items-start p-3 border rounded-lg transition-colors cursor-pointer w-full " +
                                            (isSubmitted ? (isCorrect ? "bg-green-50 border-green-300" : (isSelected ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed"))
                                                : (isSelected ? "bg-blue-50 border-blue-300" : "bg-white border-gray-200 hover:bg-gray-50"));

                                        return (
                                            <label key={option.id} className={labelClass}>
                                                <div className="flex items-center h-6 mt-0.5 shrink-0">
                                                    <input type="radio" checked={isSelected} onChange={() => handleOptionSelect(question.id, option.id)} disabled={isSubmitted} className="w-5 h-5 text-blue-600 bg-white border-gray-300 cursor-pointer" />
                                                </div>
                                                <span className={`ml-3 text-base mt-0.5 w-full ${isSubmitted ? (isCorrect ? "text-green-800 font-medium" : (isSelected ? "text-red-800 font-medium" : "text-gray-700")) : "text-gray-700"}`}>
                                                    <span className="font-semibold mr-1">{option.id}.</span> <MathText text={option.text} />
                                                </span>
                                            </label>
                                        );
                                    })}
                                    {!isSubmitted && answers[question.id] && (
                                        <button
                                            onClick={() => {
                                                const newAnswers = { ...answers };
                                                delete newAnswers[question.id];
                                                setAnswers(newAnswers);
                                            }}
                                            className="mt-3 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            Clear Choice
                                        </button>
                                    )}

                                    {flagged[question.id] && (
                                        <div className="mt-5">
                                            <label className="block text-sm font-medium text-[#c07c24] mb-2">
                                                Why did you flag this question? (Helps AI explain it to you later)
                                            </label>
                                            <textarea
                                                value={flagReasons[question.id] || ''}
                                                onChange={(e) => setFlagReasons({ ...flagReasons, [question.id]: e.target.value })}
                                                placeholder="E.g., I was confused between options B and C because..."
                                                rows="2"
                                                className="w-full border border-yellow-400 rounded-md p-3 text-sm text-gray-800 bg-[#fffeeb] focus:outline-none focus:ring-0 resize-y"
                                            />
                                        </div>
                                    )}

                                    {isSubmitted && (
                                        <div className={`mt-6 p-5 rounded-lg border text-sm sm:text-base ${answers[question.id] === question.correctAnswer
                                            ? 'bg-emerald-50/60 border-emerald-200'
                                            : 'bg-red-50/60 border-red-200'
                                            }`}>
                                            <div className="flex items-center gap-2 mb-3">
                                                {answers[question.id] === question.correctAnswer ? (
                                                    <span className="font-bold text-emerald-700 flex items-center gap-1.5 text-base">
                                                        ✓ Correct
                                                    </span>
                                                ) : (
                                                    <span className="font-bold text-red-700 flex items-center gap-1.5 text-base">
                                                        ✕ Incorrect
                                                    </span>
                                                )}
                                                <span className="text-gray-500 text-sm">
                                                    (Correct Answer: {question.correctAnswer})
                                                </span>
                                            </div>
                                            <div className="font-bold text-gray-900 mb-1.5">Explanation:</div>
                                            <div className="text-gray-800 leading-relaxed">
                                                <MathText text={question.explanation || "No detailed explanation available for this question."} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-8 flex justify-between border-t border-gray-200 pt-5">
                                <button onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} disabled={isPrevDisabled} className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 ${isPrevDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                                    </svg>
                                    Previous
                                </button>
                                <button onClick={() => setCurrentIndex(prev => Math.min(activeExam.questions.length - 1, prev + 1))} disabled={isNextDisabled} className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 ${isNextDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                                    Next
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
