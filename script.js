const { useState, useEffect, useRef } = React;

const firebaseConfig = {
    apiKey: "AIzaSyABJmXZHH3LVRb7UN_NF9lZd7k05v7rs68",
    authDomain: "exams-bfd72.firebaseapp.com",
    projectId: "exams-bfd72",
    storageBucket: "exams-bfd72.firebasestorage.app",
    messagingSenderId: "757559897577",
    appId: "1:757559897577:web:ab3af4b0c8d179bf36af78"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
try {
    db.settings({ experimentalForceLongPolling: false });
} catch (e) {
    console.warn("Firestore settings notice:", e);
}
const storage = firebase.storage();

// --- ADMIN CONFIGURATION ---
// Set your Firebase Auth UID here (found in Firebase Console > Authentication > Users).
// Any user with this UID, or whose email matches ADMIN_EMAIL, or who has role: "admin" in Firestore /users/{uid},
// will be granted complete administrator privileges across the portal.
const ADMIN_UID = "l8ly3WOk2VQda4zLmeck4CORKbt1";
const ADMIN_EMAIL = "eyob5524@gmail.com";

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
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
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
        let qType = "mcq";
        const options = [];
        const matchingPairs = [];
        let correctAnswer = "";
        let explanation = "";
        let passageTitle = defaultPassageTitle || "";
        let passage = defaultPassage || "";
        let isHTML = defaultIsHTML || false;
        let image = defaultBlockImage || "";

        lines.forEach(line => {
            const typeMatch = line.match(/^Type[:\s]*(mcq|tf|true_false|fill|blank|matching|short)/i);
            const ansMatch = line.match(/^(?:Answer|Ans|Correct)[:\s]*(.+)/i);
            const optMatch = line.match(/^([A-Z])[\.\)]\s*(.+)/i);
            const matchPairMatch = line.match(/^([1-9])[\.\)]\s*(.+?)\s*<->\s*(.+)/i);
            const expMatch = line.match(/^(?:Explanation|Exp)[:\s]*(.+)/i);
            const pTitleMatch = line.match(/^(?:Passage Title|Title)[:\s]*(.+)/i);
            const pHtmlMatch = line.match(/^(?:Passage HTML|HTML Passage|Table)[:\s]*(.+)/i);
            const pMatch = line.match(/^(?:Passage)[:\s]*(.+)/i);
            const imgMatch = line.match(/^(?:Image|Img)[:\s]*(.+)/i);

            if (typeMatch) {
                const t = typeMatch[1].toLowerCase();
                if (t.includes('tf') || t.includes('true')) qType = 'true_false';
                else if (t.includes('fill') || t.includes('blank')) qType = 'fill_blank';
                else if (t.includes('match')) qType = 'matching';
                else if (t.includes('short')) qType = 'short_answer';
                else qType = 'mcq';
            } else if (ansMatch) {
                correctAnswer = ansMatch[1].trim();
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
            } else if (qType === 'matching' && matchPairMatch) {
                matchingPairs.push({ id: matchPairMatch[1], left: matchPairMatch[2], right: matchPairMatch[3] });
            } else if (optMatch && qType === 'mcq') {
                options.push({
                    id: optMatch[1].toUpperCase(),
                    text: optMatch[2]
                });
            } else {
                questionText += (questionText ? "\n" : "") + line.replace(/^\d+[\.\)]\s*/, '');
            }
        });

        if (qType === 'mcq' && options.length === 0 && (questionText.toLowerCase().includes('true or false') || correctAnswer.match(/^(true|false)$/i))) {
            qType = 'true_false';
        }

        if (qType === 'true_false') {
            options.push({ id: 'True', text: 'True' }, { id: 'False', text: 'False' });
            correctAnswer = correctAnswer || 'True';
        }

        if (questionText) {
            parsedQuestions.push({
                id: startIdx + parsedQuestions.length,
                type: qType,
                text: questionText,
                options: options,
                pairs: matchingPairs,
                correctAnswer: correctAnswer || (options[0] ? options[0].id : ''),
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
    const str = text || '';
    const hasMath = /\$|\\\(|\\\[/.test(str);

    useEffect(() => {
        if (!hasMath) return;
        let isCancelled = false;
        const renderMath = () => {
            if (isCancelled || !containerRef.current) return;
            containerRef.current.textContent = str;
            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise([containerRef.current]).catch((err) => console.log('MathJax error:', err));
            } else {
                setTimeout(renderMath, 100);
            }
        };
        renderMath();
        return () => { isCancelled = true; };
    }, [str, hasMath]);

    if (!hasMath) {
        return <span>{str}</span>;
    }

    return <span ref={containerRef}>{str}</span>;
};

const renderFillBlankText = (text, userVal) => {
    const parts = text.split('_____');
    if (parts.length === 1) return <MathText text={text} />;
    return (
        <span>
            {parts.map((part, idx) => (
                <React.Fragment key={idx}>
                    <MathText text={part} />
                    {idx < parts.length - 1 && (
                        <span className="inline-block border-b-2 border-blue-600 px-3 py-0.5 mx-1 font-bold text-blue-800 bg-blue-50 rounded">
                            {userVal || '_____'}
                        </span>
                    )}
                </React.Fragment>
            ))}
        </span>
    );
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
const MatchingQuestionWidget = ({ question, answer, onAnswerChange, isSubmitted }) => {
    const [selectedLeft, setSelectedLeft] = useState(null);
    const pairs = question.pairs || [];
    const rights = question.shuffledRights || pairs.map(p => p.right);
    const userAnswers = answer || {};

    const handleLeftClick = (leftId) => {
        if (isSubmitted) return;
        setSelectedLeft(selectedLeft === leftId ? null : leftId);
    };

    const handleRightClick = (rightText) => {
        if (isSubmitted) return;
        if (selectedLeft !== null) {
            const updated = { ...userAnswers, [selectedLeft]: rightText };
            onAnswerChange(updated);
            setSelectedLeft(null);
        }
    };

    const handleRemoveConnection = (leftId, e) => {
        e.stopPropagation();
        if (isSubmitted) return;
        const updated = { ...userAnswers };
        delete updated[leftId];
        onAnswerChange(updated);
    };

    return (
        <div className="space-y-4 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 p-6 rounded-2xl border border-blue-200 shadow-sm">
            <div className="flex justify-between items-center">
                <div>
                    <p className="text-xs font-extrabold text-blue-900 uppercase tracking-wider">Interactive Matching Question</p>
                    <p className="text-xs text-gray-600 mt-0.5">Click an item in Column A, then click its corresponding choice in Column B to connect them.</p>
                </div>
                {!isSubmitted && Object.keys(userAnswers).length > 0 && (
                    <button
                        type="button"
                        onClick={() => onAnswerChange({})}
                        className="text-xs text-red-600 hover:text-red-800 font-bold bg-white px-3 py-1.5 rounded-lg border border-red-200 shadow-xs cursor-pointer"
                    >
                        Clear All Connections
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-8 items-start relative pt-2">
                {/* Column A */}
                <div className="space-y-3">
                    <div className="text-xs font-bold text-gray-700 uppercase tracking-wider bg-white p-2.5 rounded-xl border border-gray-200 text-center shadow-xs">
                        Column A (Items)
                    </div>
                    {pairs.map((pair) => {
                        const isConnected = userAnswers[pair.id] !== undefined;
                        const isSelected = selectedLeft === pair.id;
                        const connectedRightText = userAnswers[pair.id];
                        const rightIndex = connectedRightText ? rights.indexOf(connectedRightText) : -1;
                        const rightLetter = rightIndex >= 0 ? String.fromCharCode(65 + rightIndex) : '';

                        let submitCardStyle = 'bg-white border-gray-200';
                        if (isSubmitted) {
                            const isPairCorrect = connectedRightText !== undefined && String(connectedRightText).trim() === String(pair.right).trim();
                            submitCardStyle = isPairCorrect ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900';
                        } else if (isSelected) {
                            submitCardStyle = 'bg-blue-100 border-blue-500 ring-2 ring-blue-500/30 shadow-md';
                        } else if (isConnected) {
                            submitCardStyle = 'bg-blue-50/70 border-blue-300';
                        }

                        return (
                            <div
                                key={pair.id}
                                onClick={() => handleLeftClick(pair.id)}
                                className={`relative p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between shadow-xs ${submitCardStyle}`}
                            >
                                <div className="flex items-center gap-3 pr-4">
                                    <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                                        {pair.id}
                                    </span>
                                    <span className="text-sm font-semibold">
                                        <MathText text={pair.left} />
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    {isConnected && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${isSubmitted ? (String(connectedRightText).trim() === String(pair.right).trim() ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200') : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                                            ➔ {rightLetter}
                                        </span>
                                    )}
                                    {isConnected && !isSubmitted && (
                                        <button
                                            type="button"
                                            onClick={(e) => handleRemoveConnection(pair.id, e)}
                                            className="text-gray-400 hover:text-red-600 text-xs font-bold p-1 rounded hover:bg-red-50 cursor-pointer"
                                            title="Remove connection"
                                        >
                                            ✕
                                        </button>
                                    )}
                                    <div className={`w-4 h-4 rounded-full border-2 transition-transform ${
                                        isSubmitted
                                            ? (String(connectedRightText).trim() === String(pair.right).trim() ? 'bg-emerald-500 border-emerald-600' : 'bg-rose-500 border-rose-600')
                                            : isConnected
                                                ? 'bg-blue-600 border-blue-700 scale-110 shadow-sm'
                                                : isSelected
                                                    ? 'bg-blue-600 border-blue-700 scale-125 animate-pulse'
                                                    : 'bg-white border-gray-400'
                                    }`} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Gap Divider */}
                <div className="hidden md:flex flex-col items-center justify-center self-stretch py-4">
                    <div className="w-px h-full bg-blue-200/60 my-auto"></div>
                </div>

                {/* Column B */}
                <div className="space-y-3">
                    <div className="text-xs font-bold text-gray-700 uppercase tracking-wider bg-white p-2.5 rounded-xl border border-gray-200 text-center shadow-xs">
                        Column B (Choices)
                    </div>
                    {rights.map((rightText, rIdx) => {
                        const optionLetter = String.fromCharCode(65 + rIdx);
                        const connectedLeftId = Object.entries(userAnswers).find(([lId, rVal]) => rVal === rightText)?.[0];
                        const isConnected = connectedLeftId !== undefined;

                        return (
                            <div
                                key={rIdx}
                                onClick={() => handleRightClick(rightText)}
                                className={`relative p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between shadow-xs ${
                                    isSubmitted
                                        ? 'bg-white border-gray-200'
                                        : selectedLeft !== null
                                            ? 'bg-white border-blue-300 hover:bg-blue-50/60 hover:border-blue-500 shadow-sm'
                                            : isConnected
                                                ? 'bg-blue-50/70 border-blue-300'
                                                : 'bg-white border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border-2 transition-transform ${
                                        isConnected
                                            ? 'bg-blue-600 border-blue-700 scale-110 shadow-sm'
                                            : selectedLeft !== null
                                                ? 'bg-blue-600 border-blue-700 animate-pulse'
                                                : 'bg-white border-gray-400'
                                    }`} />
                                    <span className="text-sm font-semibold text-gray-800">
                                        <MathText text={rightText} />
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    {isConnected && (
                                        <span className="text-xs font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200">
                                            {connectedLeftId} ➔
                                        </span>
                                    )}
                                    <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 font-extrabold text-xs flex items-center justify-center shrink-0 border border-indigo-200 shadow-xs">
                                        {optionLetter}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {!isSubmitted && (
                <div className="pt-3 border-t border-blue-100 text-xs text-gray-700 flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-blue-900">Connected Pairs:</span>
                    {Object.keys(userAnswers).length === 0 ? (
                        <span className="italic text-gray-400">None connected yet. Click any item in Column A, then its match in Column B.</span>
                    ) : (
                        Object.entries(userAnswers).map(([lId, rVal]) => {
                            const rightIndex = rights.indexOf(rVal);
                            const rLetter = rightIndex >= 0 ? String.fromCharCode(65 + rightIndex) : '?';
                            return (
                                <span key={lId} className="px-3 py-1 bg-white border border-blue-200 rounded-lg font-bold text-blue-900 shadow-xs flex items-center gap-1.5">
                                    <span>Item {lId}</span>
                                    <span className="text-blue-500">🔗</span>
                                    <span>Choice {rLetter}</span>
                                </span>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};
const FeedbackAndAdminFixesWidget = ({ currentUser, userProfile, isAdmin, activeExamTitle }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('feedback'); // 'feedback' for everyone, 'admin_fixes' only for admin

    // Feedback State
    const [feedbacks, setFeedbacks] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [adminViewMode, setAdminViewMode] = useState('others'); // 'others', 'active', 'log'
    const [seenFeedbackIds, setSeenFeedbackIds] = useState([]);

    // Admin-Only Fixes / To-Do List State (stored ONLY in Firebase Firestore)
    const [adminFixes, setAdminFixes] = useState([]);
    const [loadingFixes, setLoadingFixes] = useState(false);
    const [fixTitle, setFixTitle] = useState('');
    const [fixDetails, setFixDetails] = useState('');
    const [fixPriorityPos, setFixPriorityPos] = useState(''); // empty = put at end, or number like 1 for 1st
    const [editingFixId, setEditingFixId] = useState(null);
    const [showCompletedFixes, setShowCompletedFixes] = useState(true);

    const [hasOpenedBefore, setHasOpenedBefore] = useState(() => {
        return localStorage.getItem('has_opened_feedback_widget') === 'true';
    });

    const handleToggleOpen = () => {
        const nextState = !isOpen;
        setIsOpen(nextState);
        if (nextState) {
            setActiveTab('feedback');
            if (!hasOpenedBefore) {
                setHasOpenedBefore(true);
                localStorage.setItem('has_opened_feedback_widget', 'true');
            }
        }
    };

    // Normalize order 0..n-1 cleanly
    const normalizeOrders = (list) => {
        return [...list]
            .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
            .map((item, index) => ({ ...item, order: index }));
    };

    // Persist Admin Fixes ONLY to Firebase Firestore
    const persistAdminFixes = async (nextList) => {
        const ordered = normalizeOrders(nextList);
        setAdminFixes(ordered);

        if (isAdmin && currentUser) {
            try {
                await db.collection('adminFixes').doc(currentUser.uid).set({
                    items: ordered,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch (err) {
                console.error("Failed to save admin fixes to Firestore:", err);
                alert("Could not save fix to Firebase: " + err.message);
            }
        }
    };

    // Load Admin Fixes strictly from Firebase Firestore (only when isAdmin is true)
    useEffect(() => {
        if (!isAdmin || !currentUser) {
            setAdminFixes([]);
            return;
        }

        setLoadingFixes(true);
        const unsubscribe = db.collection('adminFixes').doc(currentUser.uid).onSnapshot((doc) => {
            if (doc.exists && Array.isArray(doc.data().items)) {
                setAdminFixes(normalizeOrders(doc.data().items));
            } else {
                setAdminFixes([]);
            }
            setLoadingFixes(false);
        }, (err) => {
            console.error("Error loading admin fixes from Firestore:", err);
            setLoadingFixes(false);
        });

        return () => unsubscribe();
    }, [isAdmin, currentUser?.uid]);

    // Load seen feedback IDs from Firestore for current user
    useEffect(() => {
        if (!currentUser) {
            setSeenFeedbackIds([]);
            return;
        }

        const unsubscribe = db.collection('users').doc(currentUser.uid).onSnapshot((doc) => {
            if (doc.exists && Array.isArray(doc.data().seenFeedbackIds)) {
                setSeenFeedbackIds(doc.data().seenFeedbackIds);
            } else {
                setSeenFeedbackIds([]);
            }
        }, (err) => {
            console.warn("Seen feedback sync notice:", err);
        });

        return () => unsubscribe();
    }, [currentUser?.uid]);

    // Move an item to a specific 1-based position (1 = First, 2 = Second, etc.)
    const setItemToPosition = (list, targetId, oneBasedPos) => {
        const sorted = normalizeOrders(list);
        const movingItem = sorted.find(item => item.id === targetId);
        if (!movingItem) return sorted;

        const remaining = sorted.filter(item => item.id !== targetId);
        const parsedPos = parseInt(oneBasedPos, 10);

        if (isNaN(parsedPos) || parsedPos <= 1) {
            remaining.unshift(movingItem);
        } else if (parsedPos > remaining.length) {
            remaining.push(movingItem);
        } else {
            remaining.splice(parsedPos - 1, 0, movingItem);
        }

        return remaining.map((item, idx) => ({ ...item, order: idx }));
    };

    // Quick button: make this item #1 (first to work on)
    const handleMakeFirst = (fixId) => {
        const next = setItemToPosition(adminFixes, fixId, 1);
        persistAdminFixes(next);
    };

    // Change position to any rank (1, 2, 3...)
    const handleChangeRank = (fixId, newRank) => {
        const next = setItemToPosition(adminFixes, fixId, newRank);
        persistAdminFixes(next);
    };

    const handleSaveFix = (e) => {
        e.preventDefault();
        if (!isAdmin) return;
        const cleanTitle = fixTitle.trim();
        if (!cleanTitle) return;

        const cleanDetails = fixDetails.trim();
        const nowIso = new Date().toISOString();

        let nextList;
        if (editingFixId) {
            nextList = adminFixes.map(item => item.id === editingFixId
                ? {
                    ...item,
                    title: cleanTitle,
                    details: cleanDetails,
                    context: activeExamTitle || item.context || '',
                    updatedAt: nowIso
                }
                : item
            );
            if (fixPriorityPos !== '') {
                nextList = setItemToPosition(nextList, editingFixId, fixPriorityPos);
            }
            setEditingFixId(null);
        } else {
            const newId = `fix-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const newFix = {
                id: newId,
                title: cleanTitle,
                details: cleanDetails,
                context: activeExamTitle || '',
                completed: false,
                order: adminFixes.length,
                createdAt: nowIso,
                updatedAt: nowIso
            };
            nextList = [...adminFixes, newFix];
            if (fixPriorityPos !== '') {
                nextList = setItemToPosition(nextList, newId, fixPriorityPos);
            }
        }

        persistAdminFixes(nextList);
        setFixTitle('');
        setFixDetails('');
        setFixPriorityPos('');
    };

    const handleToggleFixCompleted = (fixId) => {
        if (!isAdmin) return;
        const nextList = adminFixes.map(item =>
            item.id === fixId
                ? { ...item, completed: !item.completed, updatedAt: new Date().toISOString() }
                : item
        );
        persistAdminFixes(nextList);
    };

    const handleStartEditFix = (fix, index) => {
        setEditingFixId(fix.id);
        setFixTitle(fix.title || '');
        setFixDetails(fix.details || '');
        setFixPriorityPos(String(index + 1));
    };

    const handleDeleteFix = (fixId) => {
        if (!isAdmin) return;
        const targetFix = adminFixes.find(item => item.id === fixId);
        const label = targetFix?.title ? `"${targetFix.title}"` : "this fix item";
        if (!window.confirm(`Delete ${label} from the Admin Fixes queue?`)) return;

        const nextList = adminFixes.filter(item => item.id !== fixId);
        persistAdminFixes(nextList);
        if (editingFixId === fixId) {
            setEditingFixId(null);
            setFixTitle('');
            setFixDetails('');
            setFixPriorityPos('');
        }
    };

    // Listen to feedback so we can show unseen feedback badge and dismiss once opened & viewed
    useEffect(() => {
        if (!currentUser) return;

        let query = db.collection('feedbacks');
        if (!isAdmin) {
            query = db.collection('feedbacks').where('userId', '==', currentUser.uid);
        }

        const unsubscribe = query.onSnapshot((snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            list.sort((a, b) => {
                const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return timeB - timeA;
            });
            setFeedbacks(list);
        }, (err) => {
            console.warn("Feedback snapshot notice:", err);
        });

        return () => unsubscribe();
    }, [currentUser, isAdmin]);

    // Dismiss feedback notifications once the user opens the widget and views the feedback tab
    useEffect(() => {
        if (!isOpen || activeTab !== 'feedback' || !currentUser) return;

        const relevantFeedbacks = feedbacks.filter(f => {
            if (f.archived) return false;
            if (isAdmin) return f.userId !== currentUser.uid;
            return (f.status === 'fixed' || f.status === 'addressed');
        });

        const unseenIds = relevantFeedbacks
            .map(f => f.id)
            .filter(id => !seenFeedbackIds.includes(id));

        if (unseenIds.length > 0) {
            const mergedSeen = Array.from(new Set([...seenFeedbackIds, ...unseenIds]));
            setSeenFeedbackIds(mergedSeen);
            db.collection('users').doc(currentUser.uid).set({
                seenFeedbackIds: mergedSeen
            }, { merge: true }).catch(err => console.warn("Error dismissing feedback badge:", err));
        }

        if (!isAdmin) {
            feedbacks.forEach(item => {
                if ((item.status === 'fixed' || item.status === 'addressed') && !item.userNotified) {
                    db.collection('feedbacks').doc(item.id).update({ userNotified: true }).catch(err => console.warn(err));
                }
            });
        }
    }, [isOpen, activeTab, feedbacks, isAdmin, currentUser, seenFeedbackIds]);

    const handleSendFeedback = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        setIsSubmitting(true);
        try {
            await db.collection('feedbacks').add({
                userId: currentUser.uid,
                username: userProfile?.username || currentUser.email,
                displayName: userProfile?.displayName || userProfile?.username || 'User',
                message: newMessage.trim(),
                status: 'pending',
                archived: false,
                userNotified: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            setNewMessage('');
        } catch (err) {
            console.error("Error sending feedback:", err);
            alert("Failed to send feedback: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateStatus = async (feedbackId, newStatus) => {
        if (!isAdmin) return;
        try {
            await db.collection('feedbacks').doc(feedbackId).update({
                status: newStatus,
                userNotified: false,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (err) {
            console.error("Error updating status:", err);
        }
    };

    const handleArchiveFeedback = async (feedbackId, archiveState) => {
        if (!isAdmin) return;
        try {
            await db.collection('feedbacks').doc(feedbackId).update({
                archived: archiveState,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (err) {
            console.error("Error archiving feedback:", err);
        }
    };

    const handleDeleteFeedback = async (feedbackId) => {
        if (!isAdmin) return;
        if (!window.confirm("Are you sure you want to permanently delete this feedback item?")) return;
        try {
            await db.collection('feedbacks').doc(feedbackId).delete();
        } catch (err) {
            console.error("Error deleting feedback:", err);
            alert("Failed to delete feedback: " + err.message);
        }
    };

    const displayedFeedbacks = feedbacks.filter(f => {
        if (isAdmin) {
            if (adminViewMode === 'others') return !f.archived && f.userId !== currentUser?.uid;
            if (adminViewMode === 'active') return !f.archived;
            return f.archived;
        }
        return !f.archived;
    });

    const orderedFixes = normalizeOrders(adminFixes);
    const remainingFixesCount = orderedFixes.filter(f => !f.completed).length;
    const visibleFixes = orderedFixes.filter(f => showCompletedFixes ? true : !f.completed);

    const unseenFeedbackCount = feedbacks.filter(f => {
        if (f.archived || seenFeedbackIds.includes(f.id)) return false;
        if (isAdmin) return f.userId !== currentUser?.uid;
        return (f.status === 'fixed' || f.status === 'addressed');
    }).length;

    return (
        <div className="fixed right-0 bottom-24 z-50 flex items-center">
            {!hasOpenedBefore && !isOpen && (
                <div className="absolute right-8 bg-gray-900 text-white text-[11px] font-medium py-1 px-2.5 rounded-md shadow-md animate-bounce pointer-events-none whitespace-nowrap flex items-center gap-1.5">
                    <span>{isAdmin ? 'Feedback & Admin Fixes' : 'Feedback'}</span>
                    <span className="text-gray-400 font-mono">→</span>
                </div>
            )}

            <button
                type="button"
                onClick={handleToggleOpen}
                className="relative bg-white hover:bg-gray-50 text-gray-500 hover:text-gray-800 border border-gray-300 border-r-0 rounded-l-md shadow-xs py-2 px-1.5 flex items-center justify-center transition-all cursor-pointer text-xs font-mono font-bold"
                title={isAdmin ? 'Feedback & Admin Fixes' : 'Feedback'}
            >
                <span>{isOpen ? '✕' : '‹'}</span>
                {unseenFeedbackCount > 0 && !isOpen && (
                    <span className="absolute -top-1.5 -left-1.5 min-w-[16px] h-4 px-1 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow">
                        {unseenFeedbackCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute bottom-0 right-6 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden flex flex-col h-[490px]">
                    {/* Header */}
                    <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                        <span className="font-bold text-xs text-gray-800">
                            {activeTab === 'admin_fixes'
                                ? 'Admin Fixes & Feature Queue'
                                : (isAdmin ? 'Feedback & Others\' Feedback' : 'My Feedback')}
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="w-6 h-6 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Tabs: Feedback for everyone; Admin Fixes tab ONLY rendered for isAdmin */}
                    {isAdmin && (
                        <div className="px-3 py-1.5 bg-gray-100 border-b border-gray-200 grid grid-cols-2 gap-1.5 text-xs font-bold">
                            <button
                                type="button"
                                onClick={() => setActiveTab('feedback')}
                                className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${activeTab === 'feedback' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
                            >
                                <span>💬 Feedbacks</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('admin_fixes')}
                                className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${activeTab === 'admin_fixes' ? 'bg-amber-600 text-white shadow-xs' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
                            >
                                <span>🛠️ Admin Fixes</span>
                                <span className={`px-1.5 rounded-full text-[10px] ${activeTab === 'admin_fixes' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'}`}>
                                    {remainingFixesCount}
                                </span>
                            </button>
                        </div>
                    )}

                    {isAdmin && activeTab === 'admin_fixes' ? (
                        <>
                            {/* Admin Fix / Feature Composer */}
                            <form onSubmit={handleSaveFix} className="p-3 bg-white border-b border-gray-200 space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={fixTitle}
                                        onChange={(e) => setFixTitle(e.target.value)}
                                        placeholder="Fix or feature to add (e.g. Fix timer pause bug)..."
                                        className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-amber-500 outline-none"
                                    />
                                    <input
                                        type="number"
                                        min="1"
                                        max={Math.max(1, orderedFixes.length + 1)}
                                        value={fixPriorityPos}
                                        onChange={(e) => setFixPriorityPos(e.target.value)}
                                        title="Set order # (1 = first)"
                                        placeholder="#"
                                        className="w-12 border border-gray-300 rounded-lg px-1.5 py-1.5 text-xs font-bold text-center focus:ring-1 focus:ring-amber-500 outline-none"
                                    />
                                </div>
                                <textarea
                                    value={fixDetails}
                                    onChange={(e) => setFixDetails(e.target.value)}
                                    rows="2"
                                    placeholder="Optional details or steps..."
                                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                                ></textarea>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        {editingFixId ? (
                                            <button
                                                type="button"
                                                onClick={() => { setEditingFixId(null); setFixTitle(''); setFixDetails(''); setFixPriorityPos(''); }}
                                                className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                        ) : (
                                            <span className="text-[10px] text-gray-400">Tip: Put #1 to work on it first</span>
                                        )}
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!fixTitle.trim()}
                                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white font-bold text-xs rounded-lg cursor-pointer"
                                    >
                                        {editingFixId ? 'Update Item' : '+ Add to Queue'}
                                    </button>
                                </div>
                            </form>

                            {/* Filter bar for completed items */}
                            <div className="px-3 py-1.5 bg-amber-50/70 border-b border-amber-100 flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-amber-900">
                                    {remainingFixesCount} left to work on
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowCompletedFixes(!showCompletedFixes)}
                                    className="font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                                >
                                    {showCompletedFixes ? 'Hide Completed' : 'Show Completed'}
                                </button>
                            </div>

                            {/* Ordered Fixes List */}
                            <div className="flex-1 p-3 overflow-y-auto space-y-2 bg-gray-50/50">
                                {loadingFixes ? (
                                    <div className="text-center py-8 text-gray-400 text-xs">
                                        Loading fixes from Firebase...
                                    </div>
                                ) : visibleFixes.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 text-xs">
                                        No items in your fix queue. Add something above whenever an idea comes up!
                                    </div>
                                ) : (
                                    visibleFixes.map((fix, idx) => {
                                        const rankNumber = idx + 1;
                                        return (
                                            <div
                                                key={fix.id}
                                                className={`p-2.5 rounded-lg border text-xs space-y-1.5 transition-all ${
                                                    fix.completed
                                                        ? 'bg-emerald-50/80 border-emerald-200 opacity-80'
                                                        : rankNumber === 1
                                                            ? 'bg-amber-50/60 border-amber-300 shadow-2xs'
                                                            : 'bg-white border-gray-200 shadow-2xs'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <label className="flex items-start gap-2 cursor-pointer flex-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(fix.completed)}
                                                            onChange={() => handleToggleFixCompleted(fix.id)}
                                                            className="mt-0.5 w-3.5 h-3.5 text-emerald-600 rounded border-gray-300 cursor-pointer shrink-0"
                                                        />
                                                        <span className={`font-bold leading-snug ${fix.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                                            <span className={`mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-black ${
                                                                fix.completed
                                                                    ? 'bg-emerald-100 text-emerald-700'
                                                                    : rankNumber === 1
                                                                        ? 'bg-amber-600 text-white'
                                                                        : 'bg-gray-100 text-gray-700'
                                                            }`}>
                                                                #{rankNumber}
                                                            </span>
                                                            {fix.title}
                                                        </span>
                                                    </label>

                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStartEditFix(fix, idx)}
                                                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 px-1 cursor-pointer"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteFix(fix.id)}
                                                            className="text-[11px] font-semibold text-red-500 hover:text-red-700 px-1 cursor-pointer"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </div>

                                                {fix.details && (
                                                    <p className={`pl-5 text-[11px] whitespace-pre-wrap leading-relaxed ${fix.completed ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                                                        {fix.details}
                                                    </p>
                                                )}

                                                {/* Order / Priority Controls */}
                                                {!fix.completed && (
                                                    <div className="pl-5 pt-1 flex items-center justify-between gap-2 text-[10px]">
                                                        {rankNumber > 1 ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMakeFirst(fix.id)}
                                                                className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold cursor-pointer"
                                                            >
                                                                Set as #1 (First)
                                                            </button>
                                                        ) : (
                                                            <span className="text-amber-700 font-bold">★ Working on next</span>
                                                        )}

                                                        <div className="flex items-center gap-1 text-gray-500">
                                                            <span>Order:</span>
                                                            <select
                                                                value={rankNumber}
                                                                onChange={(e) => handleChangeRank(fix.id, Number(e.target.value))}
                                                                className="border border-gray-300 rounded px-1 py-0.5 bg-white text-gray-800 font-bold cursor-pointer"
                                                            >
                                                                {orderedFixes.map((_, rIdx) => (
                                                                    <option key={rIdx + 1} value={rIdx + 1}>
                                                                        #{rIdx + 1}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            {isAdmin && (
                                <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 flex gap-1.5 text-[11px] font-bold flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => setAdminViewMode('others')}
                                        className={`px-2 py-1 rounded cursor-pointer ${adminViewMode === 'others' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border'}`}
                                    >
                                        Others' Feedback ({feedbacks.filter(f => !f.archived && f.userId !== currentUser?.uid).length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdminViewMode('active')}
                                        className={`px-2 py-1 rounded cursor-pointer ${adminViewMode === 'active' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'}`}
                                    >
                                        All Active ({feedbacks.filter(f => !f.archived).length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdminViewMode('log')}
                                        className={`px-2 py-1 rounded cursor-pointer ${adminViewMode === 'log' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'}`}
                                    >
                                        Log ({feedbacks.filter(f => f.archived).length})
                                    </button>
                                </div>
                            )}

                            <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-gray-50/50">
                                {displayedFeedbacks.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400 text-xs">
                                        {isAdmin
                                            ? (adminViewMode === 'others' ? 'No feedback from other users yet.' : (adminViewMode === 'active' ? 'No active feedback in the box.' : 'Feedback log is empty.'))
                                            : 'No feedback messages yet.'}
                                    </div>
                                ) : (
                                    displayedFeedbacks.map((item) => {
                                        const isFixed = item.status === 'fixed' || item.status === 'addressed';
                                        return (
                                            <div
                                                key={item.id}
                                                className={`p-3 rounded-lg border text-xs space-y-2 ${isFixed ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-gray-800">@{item.username || 'user'}</span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isFixed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                                        {isFixed ? 'Addressed' : 'Pending'}
                                                    </span>
                                                </div>
                                                <p className="text-gray-700 bg-white p-2 rounded border border-gray-100">
                                                    {item.message}
                                                </p>

                                                {isAdmin && (
                                                    <div className="pt-2 border-t flex items-center justify-between gap-1 flex-wrap">
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateStatus(item.id, isFixed ? 'pending' : 'fixed')}
                                                                className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${isFixed ? 'bg-gray-200 text-gray-700' : 'bg-emerald-600 text-white'}`}
                                                            >
                                                                {isFixed ? 'Reopen' : 'Mark Addressed'}
                                                            </button>

                                                            {isFixed && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleArchiveFeedback(item.id, !item.archived)}
                                                                    className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${item.archived ? 'bg-amber-600 text-white' : 'bg-gray-800 text-white'}`}
                                                                >
                                                                    {item.archived ? 'Restore' : 'Archive ➔'}
                                                                </button>
                                                            )}
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteFeedback(item.id)}
                                                            className="px-2.5 py-1 rounded text-[11px] font-bold bg-red-100 text-red-700 hover:bg-red-200 transition-colors cursor-pointer"
                                                            title="Permanently Delete"
                                                        >
                                                            🗑️ Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {!isAdmin && (
                                <form onSubmit={handleSendFeedback} className="p-3 bg-white border-t border-gray-200 flex gap-2">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Send feedback or bug report..."
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !newMessage.trim()}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                                    >
                                        Send
                                    </button>
                                </form>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};


const isValidEmailFormat = (val) => {
    const trimmed = (val || '').trim();
    const match = trimmed.match(/^[^\s@]+@([^\s@.]+\.)+[a-zA-Z]{2,}$/);
    if (!match) return false;
    const domain = trimmed.split('@')[1].toLowerCase();
    const blockedDomains = ['example.com', 'example.org', 'example.net', 'test.com', 'localhost', 'invalid.com'];
    return !blockedDomains.includes(domain);
};

const AuthScreen = ({ onAuthSuccess }) => {
    const [authMode, setAuthMode] = useState('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [authError, setAuthError] = useState('');
    const [authInfo, setAuthInfo] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [resetEmailSent, setResetEmailSent] = useState(false);

    const handleGoogleSignIn = async () => {
        setAuthError('');
        setAuthInfo('');
        setIsSubmitting(true);
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await auth.signInWithPopup(provider);
        } catch (err) {
            console.error("Google sign-in error:", err);
            if (err.code === 'auth/unauthorized-domain') {
                setAuthError("Google Sign-In failed: This domain isn't authorized in Firebase Console yet (Authentication > Settings > Authorized domains). Use email & password below, or add this domain in Firebase Console.");
            } else if (err.code === 'auth/popup-closed-by-user') {
                setAuthError("Google sign-in was cancelled.");
            } else {
                setAuthError(err.message || "Failed to sign in with Google.");
            }
            setIsSubmitting(false);
        }
    };

    const handleEmailAuth = async (e) => {
        if (e) e.preventDefault();
        setAuthError('');
        setAuthInfo('');

        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !password) {
            setAuthError("Please enter both your email address and password.");
            return;
        }

        if (!isValidEmailFormat(cleanEmail)) {
            setAuthError("Please enter a real, valid email address (e.g. name@gmail.com).");
            return;
        }

        if (authMode === 'signup') {
            if (password.length < 6) {
                setAuthError("Password must be at least 6 characters.");
                return;
            }

            setIsSubmitting(true);
            try {
                const userCred = await auth.createUserWithEmailAndPassword(cleanEmail, password);
                const user = userCred.user;
                const isUserAdmin = user.uid === ADMIN_UID || (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());

                try {
                    await user.sendEmailVerification();
                } catch (verErr) {
                    console.warn("Verification email notice:", verErr);
                }

                const baseProfile = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || cleanEmail.split('@')[0],
                    username: '',
                    emailVerified: Boolean(user.emailVerified),
                    role: isUserAdmin ? 'admin' : 'user',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                try {
                    await db.collection('users').doc(user.uid).set(baseProfile, { merge: true });
                } catch (e) {
                    console.warn("Could not save initial profile doc:", e);
                }

                if (onAuthSuccess) onAuthSuccess(user, baseProfile);
            } catch (err) {
                console.error("Sign up error:", err);
                if (err.code === 'auth/email-already-in-use') {
                    // Email is already registered -> switch to Sign In so the user can log in directly
                    setAuthMode('signin');
                    setAuthInfo("This email is already registered. We switched you to Sign In—enter your password to log in.");
                } else if (err.code === 'auth/invalid-email') {
                    setAuthError("That email address is not valid. Please check and enter a real email.");
                } else if (err.code === 'auth/operation-not-allowed') {
                    setAuthError("Email/Password sign-in is disabled in Firebase Console. Enable it under Authentication > Sign-in method.");
                } else if (err.code === 'auth/weak-password') {
                    setAuthError("Password is too weak. Use at least 6 characters.");
                } else {
                    setAuthError(err.message || "Failed to create account.");
                }
                setIsSubmitting(false);
            }
        } else {
            setIsSubmitting(true);
            try {
                const userCred = await auth.signInWithEmailAndPassword(cleanEmail, password);
                const user = userCred.user;
                let profile = null;
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (userDoc.exists) { profile = userDoc.data(); }
                } catch (dbErr) { console.warn('Profile load notice:', dbErr); }
                if (onAuthSuccess) { onAuthSuccess(user, profile); }
            } catch (err) {
                console.error("Sign in error:", err);
                if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                    setAuthError("Incorrect email or password. If you don't have an account yet, click 'Create Account' above.");
                } else if (err.code === 'auth/invalid-email') {
                    setAuthError("Please enter a valid email address.");
                } else if (err.code === 'auth/operation-not-allowed') {
                    setAuthError("Email/Password sign-in is disabled in Firebase Console. Enable it under Authentication > Sign-in method.");
                } else {
                    setAuthError(err.message || "Could not sign in.");
                }
                setIsSubmitting(false);
            }
        }
    };

    const handleForgotPassword = async () => {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !isValidEmailFormat(cleanEmail)) {
            setAuthError("Please enter a valid email address above to receive a password reset link.");
            return;
        }
        try {
            await auth.sendPasswordResetEmail(cleanEmail);
            setResetEmailSent(true);
            setAuthError('');
            setTimeout(() => setResetEmailSent(false), 5000);
        } catch (err) {
            setAuthError(err.message || "Failed to send reset email.");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-8 pb-6 text-center bg-gradient-to-b from-blue-50/50 to-transparent">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-blue-500/25">
                        EP
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Exam Portal</h2>
                    <p className="mt-1 text-xs text-gray-500">
                        {authMode === 'signin' ? 'Sign in to access your exams and trial history' : 'Create an account with a real email to get started'}
                    </p>

                    <div className="mt-5 grid grid-cols-2 p-1 bg-gray-100 rounded-xl">
                        <button
                            type="button"
                            onClick={() => { setAuthMode('signin'); setAuthError(''); setAuthInfo(''); }}
                            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${authMode === 'signin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Sign In
                        </button>
                        <button
                            type="button"
                            onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthInfo(''); }}
                            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${authMode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Create Account
                        </button>
                    </div>
                </div>

                <div className="px-8 pb-8 space-y-4">
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>Continue with Google</span>
                    </button>

                    <div className="flex items-center gap-3 my-2">
                        <div className="flex-1 h-px bg-gray-200"></div>
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">or with email</span>
                        <div className="flex-1 h-px bg-gray-200"></div>
                    </div>

                    {authInfo && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 font-medium leading-relaxed">
                            {authInfo}
                        </div>
                    )}

                    {authError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium leading-relaxed">
                            {authError}
                        </div>
                    )}

                    {resetEmailSent && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium">
                            Password reset link sent! Please check your email inbox.
                        </div>
                    )}

                    <form onSubmit={handleEmailAuth} className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@example.com"
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            {authMode === 'signup' && (
                                <span className="text-[10px] text-gray-400 mt-0.5 block">We'll send a verification link to confirm this email exists.</span>
                            )}
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold text-gray-700">Password</label>
                                {authMode === 'signin' && (
                                    <button
                                        type="button"
                                        onClick={handleForgotPassword}
                                        className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                                    >
                                        Forgot?
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={authMode === 'signup' ? 'Min 6 characters' : 'Enter password'}
                                    className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 text-xs font-semibold cursor-pointer"
                                >
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full py-2.5 mt-2 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'}`}
                        >
                            {isSubmitting ? 'Processing...' : (authMode === 'signin' ? 'Sign In to Portal' : 'Create My Account')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

const ChooseUsernameModal = ({ user, onComplete }) => {
    const [chosenUsername, setChosenUsername] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        const cleanUser = chosenUsername.trim().toLowerCase();
        if (!cleanUser) {
            setError("Please enter a username.");
            return;
        }
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUser)) {
            setError("Username must be 3-20 characters long and contain only letters, numbers, and underscores.");
            return;
        }

        setIsSaving(true);
        setError('');
        try {
            const isUserAdmin = user.uid === ADMIN_UID || (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
            const fallbackName = user.displayName || (user.email ? user.email.split('@')[0] : cleanUser);

            const profile = {
                uid: user.uid,
                email: user.email,
                displayName: fallbackName,
                username: cleanUser,
                photoURL: user.photoURL || '',
                role: isUserAdmin ? 'admin' : 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const usernameRef = db.collection('usernames').doc(cleanUser);
            const userRef = db.collection('users').doc(user.uid);

            await db.runTransaction(async (transaction) => {
                const usernameDoc = await transaction.get(usernameRef);
                if (usernameDoc.exists && usernameDoc.data().uid !== user.uid) {
                    throw new Error("USERNAME_TAKEN");
                }
                transaction.set(usernameRef, {
                    uid: user.uid,
                    username: cleanUser,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                transaction.set(userRef, profile, { merge: true });
            });

            onComplete(profile);
        } catch (err) {
            console.error("Error setting username:", err);
            if (err.message === "USERNAME_TAKEN") {
                setError(`@${cleanUser} is already taken. Please choose another username.`);
            } else {
                setError(err.message || "Failed to set username.");
            }
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
                <div className="text-center mb-4">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl">
                        @
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Choose a Unique Username</h3>
                    <p className="text-xs text-gray-500 mt-1">
                        You're signed in! Pick a unique username so others can share exams with you.
                    </p>
                </div>

                {error && (
                    <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSave} className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Unique Username</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-xs font-bold text-gray-400">@</span>
                            <input
                                type="text"
                                required
                                value={chosenUsername}
                                onChange={(e) => setChosenUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                placeholder="your_username"
                                className="w-full pl-7 pr-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                            />
                        </div>
                        <span className="text-[10px] text-gray-400 mt-0.5 block">3-20 characters: letters, numbers, underscores only.</span>
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className={`w-full py-2.5 mt-2 text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {isSaving ? 'Saving Username...' : 'Save Username'}
                    </button>
                </form>
            </div>
        </div>
    );
};


function App() {
    const [exams, setExams] = useState([]);
    const [loadingExams, setLoadingExams] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [currentView, setCurrentView] = useState('dashboard');
    const [activeExam, setActiveExam] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [flagged, setFlagged] = useState({});
    const [flagReasons, setFlagReasons] = useState({});
    const [score, setScore] = useState(0);
    const [manualOverrides, setManualOverrides] = useState({});
    const [selfMarkQueue, setSelfMarkQueue] = useState([]);
    const [selfMarkPos, setSelfMarkPos] = useState(0);
    const [confirmingGrade, setConfirmingGrade] = useState(false);
    const [openedFromConfirm, setOpenedFromConfirm] = useState(false);
    const [uatSection, setUatSection] = useState(null);
    const [submissionDate, setSubmissionDate] = useState(null);

    // Auth & User Profile State
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [showChooseUsernameModal, setShowChooseUsernameModal] = useState(false);
    const [googleUserPendingUsername, setGoogleUserPendingUsername] = useState(null);

    // Dashboard Tabs: 'official', 'practice', 'my_exams', 'public', 'shared', 'admin_console'
    const [dashboardTab, setDashboardTab] = useState('official');
    const [communityFilter, setCommunityFilter] = useState('qualified'); // 'qualified' | 'pending'

    const isExamQualified = (exam) => {
        if (exam.adminQualified === true) return true;
        if (exam.adminQualified === false) return false;
        // Legacy compatibility: public exams with at least 1 valid question stay visible unless rejected
        return Array.isArray(exam.questions) && exam.questions.length > 0;
    };

    const isPracticeFromAdmin = (exam) => {
        if (exam.isUniversal || exam.collectionSource === 'exams') return false;
        if (exam.ownerId === currentUser?.uid) return false;
        return exam.ownerId === ADMIN_UID || exam.sharedFromAdmin === true;
    };

    // Share Modal State
    const [sharingExam, setSharingExam] = useState(null);
    const [shareVisibility, setShareVisibility] = useState('private');
    const [shareWithAdmin, setShareWithAdmin] = useState(true);
    const [shareUserSearch, setShareUserSearch] = useState('');
    const [shareSearchResults, setShareSearchResults] = useState([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const [selectedShareUsers, setSelectedShareUsers] = useState([]);
    const [isSavingShare, setIsSavingShare] = useState(false);

    // Add Exam Modal: destination ('universal' | 'userExam') & visibility ('private' | 'public')
    const [examDestination, setExamDestination] = useState('universal');
    const [examVisibility, setExamVisibility] = useState('private');

    // Admin Console states
    const [allUsersList, setAllUsersList] = useState([]);
    const [loadingAllUsers, setLoadingAllUsers] = useState(false);
    const [selectedAdminUserFilter, setSelectedAdminUserFilter] = useState(null);

    // Last recorded attempt Firestore ID
    const [lastSubmissionDocId, setLastSubmissionDocId] = useState(null);

    // High Scores & History states (backed by Firestore)
    const [highScores, setHighScores] = useState({});
    const [examHistory, setExamHistory] = useState({});

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

    const SUBJECT_TIME_PER_QUESTION = {
        'Mathematics': 3.0,
        'Physics': 2.5,
        'Aptitude': 2.0,
        'Chemistry': 1.875,
        'Biology': 1.5,
        'English': 1.2,
        'Default': 1.2
    };

    const [showAddModal, setShowAddModal] = useState(false);
    const [examTitle, setExamTitle] = useState('');
    const [examType, setExamType] = useState('default');
    const [examSubject, setExamSubject] = useState('');
    const [examDescription, setExamDescription] = useState('');
    const [totalQuestions, setTotalQuestions] = useState(60);

    const [useDefaultTimer, setUseDefaultTimer] = useState(true);
    const [customTimerMode, setCustomTimerMode] = useState('perQuestion');
    const [customMinsPerQuestion, setCustomMinsPerQuestion] = useState(1.2);
    const [plainHours, setPlainHours] = useState(1);
    const [plainMinutes, setPlainMinutes] = useState(0);
    const [plainSeconds, setPlainSeconds] = useState(0);

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
    const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportSelectedIds, setExportSelectedIds] = useState(new Set());
    const [copySuccess, setCopySuccess] = useState(false);

    // Admin authorization check
    const isAdmin = Boolean(
        (userProfile && userProfile.role === 'admin') ||
        (currentUser && (currentUser.uid === ADMIN_UID || (currentUser.email && currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase())))
    );

    // Auth State Observer (fast startup + parallel history load)
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                setCurrentUser(user);
                setAuthLoading(false);
                loadUserHistory(user.uid);
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (userDoc.exists && userDoc.data()?.username) {
                        setUserProfile(userDoc.data());
                        setShowChooseUsernameModal(false);
                        setGoogleUserPendingUsername(null);
                    } else {
                        setUserProfile(userDoc.exists ? userDoc.data() : null);
                        setGoogleUserPendingUsername(user);
                        setShowChooseUsernameModal(true);
                    }
                } catch (err) {
                    console.error("Error fetching user profile:", err);
                    setGoogleUserPendingUsername(user);
                    setShowChooseUsernameModal(true);
                }
            } else {
                setCurrentUser(null);
                setUserProfile(null);
                setHighScores({});
                setExamHistory({});
                setAuthLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    // Load User History from Firestore with localStorage fallback/migration
    const loadUserHistory = async (uid) => {
        try {
            const attemptsSnap = await db.collection('userHistory').doc(uid).collection('attempts').orderBy('date', 'desc').get();
            const historyMap = {};

            if (attemptsSnap.empty) {
                // One-time automatic migration of previous local storage history
                try {
                    const localHistStr = localStorage.getItem('exam_history_logs');
                    if (localHistStr) {
                        const localHist = JSON.parse(localHistStr);
                        const batch = db.batch();
                        let count = 0;
                        Object.entries(localHist).forEach(([examId, trials]) => {
                            if (Array.isArray(trials)) {
                                trials.forEach(trial => {
                                    const ref = db.collection('userHistory').doc(uid).collection('attempts').doc();
                                    batch.set(ref, {
                                        examId: examId,
                                        score: trial.score || 0,
                                        total: trial.total || 1,
                                        scorePct: trial.scorePct || 0,
                                        date: trial.date || new Date().toISOString()
                                    });
                                    count++;
                                    if (!historyMap[examId]) historyMap[examId] = [];
                                    historyMap[examId].push({
                                        id: ref.id,
                                        score: trial.score || 0,
                                        total: trial.total || 1,
                                        scorePct: trial.scorePct || 0,
                                        date: trial.date || new Date().toISOString()
                                    });
                                });
                            }
                        });
                        if (count > 0) {
                            await batch.commit();
                        }
                    }
                } catch (e) {
                    console.warn("Local storage migration skipped:", e);
                }
            } else {
                attemptsSnap.docs.forEach(doc => {
                    const data = doc.data();
                    const eId = data.examId;
                    if (!historyMap[eId]) historyMap[eId] = [];
                    historyMap[eId].push({
                        id: doc.id,
                        score: data.score,
                        total: data.total,
                        scorePct: data.scorePct,
                        date: data.date
                    });
                });
            }

            setExamHistory(historyMap);

            const highMap = {};
            Object.entries(historyMap).forEach(([eId, trials]) => {
                if (trials.length > 0) {
                    highMap[eId] = Math.max(...trials.map(t => t.scorePct));
                }
            });
            setHighScores(highMap);
        } catch (err) {
            console.error("Error loading user history:", err);
        }
    };

    // Load Exams from Firestore (/exams and /userExams) with session cache
    const loadExams = async (forceRefresh = false) => {
        const cacheKey = currentUser ? `cached_exams_${currentUser.uid}` : null;
        if (!forceRefresh && cacheKey) {
            try {
                const cachedRaw = sessionStorage.getItem(cacheKey);
                if (cachedRaw) {
                    const parsed = JSON.parse(cachedRaw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setExams(parsed);
                        setLoadingExams(false);
                    }
                }
            } catch (e) { /* ignore cache parse errors */ }
        }

        if (exams.length === 0) setLoadingExams(true);
        setFetchError(null);
        try {
            const universalPromise = db.collection('exams').get();

            let userExamsPromise;
            if (isAdmin) {
                userExamsPromise = db.collection('userExams').get().then(snap =>
                    snap.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        collectionSource: 'userExams',
                        isUniversal: false
                    }))
                );
            } else if (currentUser) {
                userExamsPromise = Promise.all([
                    db.collection('userExams').where('ownerId', '==', currentUser.uid).get().catch(() => ({ docs: [] })),
                    db.collection('userExams').where('visibility', '==', 'public').get().catch(() => ({ docs: [] })),
                    db.collection('userExams').where('sharedWith', 'array-contains', currentUser.uid).get().catch(() => ({ docs: [] }))
                ]).then(([mySnap, publicSnap, sharedSnap]) => {
                    const mapById = new Map();
                    [...mySnap.docs, ...publicSnap.docs, ...sharedSnap.docs].forEach(doc => {
                        if (!mapById.has(doc.id)) {
                            mapById.set(doc.id, {
                                id: doc.id,
                                ...doc.data(),
                                collectionSource: 'userExams',
                                isUniversal: false
                            });
                        }
                    });
                    return Array.from(mapById.values());
                });
            } else {
                userExamsPromise = Promise.resolve([]);
            }

            const [universalSnap, userExams] = await Promise.all([universalPromise, userExamsPromise]);
            const universalExams = universalSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                collectionSource: 'exams',
                isUniversal: true,
                visibility: 'universal'
            }));

            const combined = [...universalExams, ...userExams];
            setExams(combined);
            if (cacheKey) {
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify(combined));
                } catch (e) { /* ignore quota errors */ }
            }
        } catch (err) {
            console.error("Error fetching exams: ", err);
            setFetchError(err.message);
        } finally {
            setLoadingExams(false);
        }
    };

    useEffect(() => {
        if (currentUser) {
            loadExams();
        }
    }, [currentUser?.uid, isAdmin]);

    // Load all registered users for Admin Console
    const loadAllUsers = async () => {
        if (!isAdmin) return;
        setLoadingAllUsers(true);
        try {
            const snap = await db.collection('users').get();
            setAllUsersList(snap.docs.map(d => d.data()));
        } catch (err) {
            console.error("Error loading users:", err);
        } finally {
            setLoadingAllUsers(false);
        }
    };

    useEffect(() => {
        if (dashboardTab === 'admin_console' && isAdmin) {
            loadAllUsers();
        }
    }, [dashboardTab, isAdmin]);

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

    useEffect(() => {
        if (currentView === 'self_marking' && selfMarkQueue.length > 0) {
            const expectedIdx = selfMarkQueue[selfMarkPos];
            if (expectedIdx !== undefined && currentIndex !== expectedIdx) {
                setCurrentIndex(expectedIdx);
            }
        }
    }, [currentView, selfMarkQueue, selfMarkPos, currentIndex]);

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

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (currentView === 'self_marking') {
                e.preventDefault();
                return;
            }
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
                const key = e.key.toUpperCase();
                const question = activeExam?.questions[currentIndex];

                if (question && (question.type === 'mcq' || question.type === 'true_false')) {
                    if (/^[A-Z]$/.test(key)) {
                        let selectedVal = key;
                        if (question.type === 'true_false') {
                            if (key === 'T') selectedVal = 'True';
                            if (key === 'F') selectedVal = 'False';
                        }
                        const validOption = question.options.some(o => o.id === selectedVal);
                        if (validOption) {
                            setAnswers(prev => ({ ...prev, [question.id]: selectedVal }));
                        }
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentView, activeExam, currentIndex, uatSection]);

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

        let calculatedDurationMinutes = 60;
        if (examType === 'UAT') {
            calculatedDurationMinutes = 150;
        } else if (useDefaultTimer) {
            const rate = SUBJECT_TIME_PER_QUESTION[effectiveSubject] || SUBJECT_TIME_PER_QUESTION['Default'];
            calculatedDurationMinutes = Math.round(compiledQuestions.length * rate);
        } else if (customTimerMode === 'perQuestion') {
            calculatedDurationMinutes = Math.round(compiledQuestions.length * Number(customMinsPerQuestion));
        } else {
            const totalSecs = (Number(plainHours) * 3600) + (Number(plainMinutes) * 60) + Number(plainSeconds);
            calculatedDurationMinutes = Math.max(1, Math.round(totalSecs / 60));
        }

        const isSavingAsUniversal = isAdmin && examDestination === 'universal';
        const targetCollection = isSavingAsUniversal ? 'exams' : 'userExams';

        const newExamObj = {
            id: generatedId,
            title: examTitle,
            type: examType,
            subject: effectiveSubject,
            durationMinutes: calculatedDurationMinutes,
            description: examDescription,
            questions: compiledQuestions,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            ownerId: currentUser ? currentUser.uid : null,
            ownerUsername: userProfile ? userProfile.username : 'admin',
            ownerDisplayName: userProfile ? (userProfile.displayName || userProfile.username) : 'Admin',
            isUniversal: isSavingAsUniversal,
            visibility: isSavingAsUniversal ? 'universal' : examVisibility,
            sharedWith: [],
            sharedWithUsernames: [],
            collectionSource: targetCollection
        };

        try {
            await db.collection(targetCollection).doc(generatedId).set(newExamObj);
            setExams(prev => [newExamObj, ...prev]);

            setExamTitle('');
            setExamType('default');
            setExamSubject('');
            setExamDescription('');
            setTotalQuestions(60);
            setExamBlocks([{ id: 1, startQ: 1, endQ: 60, passageTitle: '', passage: '', isHTML: false, blockImage: '', rawText: '' }]);
            setUatEnglishBlocks([{ id: 1, startQ: 1, endQ: 55, passageTitle: '', passage: '', isHTML: false, blockImage: '', rawText: '' }]);
            setUatMathBlocks([{ id: 2, startQ: 56, endQ: 100, passageTitle: '', passage: '', isHTML: false, blockImage: '', rawText: '' }]);
            setShowAddModal(false);

            alert(`Exam successfully published with ${compiledQuestions.length} questions!`);
        } catch (error) {
            console.error("Error saving exam to Firestore: ", error);
            alert("Failed to save exam: " + error.message);
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
                { id: "D", text: "Option D" },
                { id: "E", text: "Option E" }
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

        const targetCollection = editingExam.collectionSource === 'userExams' ? 'userExams' : 'exams';

        try {
            await db.collection(targetCollection).doc(editingExam.id).set(updatedExamData, { merge: true });
            setExams(prev => prev.map(e => e.id === editingExam.id ? updatedExamData : e));
            setEditingExam(null);
            alert("Exam updated successfully!");
        } catch (err) {
            console.error("Error updating exam:", err);
            alert("Failed to update exam: " + err.message);
        } finally {
            setIsUpdatingExam(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!examToDelete) return;
        setIsDeleting(true);
        const targetCollection = examToDelete.collectionSource === 'userExams' ? 'userExams' : 'exams';
        try {
            await db.collection(targetCollection).doc(examToDelete.id).delete();

            // Clear history for this exam if any
            if (currentUser) {
                try {
                    const snap = await db.collection('userHistory').doc(currentUser.uid).collection('attempts')
                        .where('examId', '==', examToDelete.id).get();
                    const batch = db.batch();
                    snap.docs.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                } catch (e) { }
            }

            setExamHistory(prev => {
                const updated = { ...prev };
                delete updated[examToDelete.id];
                return updated;
            });

            setHighScores(prev => {
                const updated = { ...prev };
                delete updated[examToDelete.id];
                return updated;
            });

            setExams(prev => prev.filter(e => e.id !== examToDelete.id));
            setExamToDelete(null);
        } catch (err) {
            console.error("Error deleting exam:", err);
            alert("Failed to delete exam from database: " + err.message);
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
        const shouldShuffle = exam.shuffleQuestions !== false;
        if (shouldShuffle) {
            if (exam.type === 'UAT') {
                const englishPart = shuffleArray(shuffledQuestions.slice(0, 55));
                const mathPart = shuffleArray(shuffledQuestions.slice(55));
                shuffledQuestions = [...englishPart, ...mathPart];
            } else {
                shuffledQuestions = shuffleArray(shuffledQuestions);
            }
        }

        shuffledQuestions = shuffledQuestions.map(q => {
            if (q.type === 'matching' && q.pairs && q.pairs.length > 0) {
                const rights = q.pairs.map(p => p.right);
                return {
                    ...q,
                    shuffledRights: shuffleArray(rights)
                };
            }
            return q;
        });

        setActiveExam({ ...exam, questions: shuffledQuestions });
        setManualOverrides({});
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

    const getMatchingMatchedCount = (q, userAns) => {
        if (!q.pairs || !userAns || typeof userAns !== 'object') return 0;
        let count = 0;
        q.pairs.forEach(p => {
            if (userAns[p.id] !== undefined && String(userAns[p.id]).trim() === String(p.right).trim()) {
                count++;
            }
        });
        return count;
    };

    const getQuestionMaxScore = (q) => {
        if (q.type === 'matching' && q.pairs && q.pairs.length > 0) {
            return q.pairs.length;
        }
        return 1;
    };

    const getQuestionEarnedScore = (q, userAns, overrides) => {
        if (overrides && overrides[q.id] !== undefined) {
            return overrides[q.id] ? getQuestionMaxScore(q) : 0;
        }
        if (userAns === undefined || userAns === null || userAns === '') return 0;

        if (q.type === 'fill_blank' || q.type === 'short_answer') {
            const correctOpts = String(q.correctAnswer).split('|').map(s => s.trim().toLowerCase());
            return correctOpts.includes(String(userAns).trim().toLowerCase()) ? 1 : 0;
        } else if (q.type === 'matching') {
            return getMatchingMatchedCount(q, userAns);
        } else {
            return String(userAns).trim() === String(q.correctAnswer).trim() ? 1 : 0;
        }
    };

    const isOriginallyCorrect = (q) => {
        const earned = getQuestionEarnedScore(q, answers[q.id], {});
        return earned === getQuestionMaxScore(q);
    };

    const isQuestionCorrect = (q) => {
        const earned = getQuestionEarnedScore(q, answers[q.id], manualOverrides);
        return earned === getQuestionMaxScore(q);
    };

    const calculateCurrentScore = () => {
        if (!activeExam || !activeExam.questions) return 0;
        let totalScore = 0;
        activeExam.questions.forEach(q => {
            totalScore += getQuestionEarnedScore(q, answers[q.id], manualOverrides);
        });
        return totalScore;
    };

    const getTotalPossibleScore = (exam) => {
        if (!exam || !exam.questions) return 0;
        let total = 0;
        exam.questions.forEach(q => {
            total += getQuestionMaxScore(q);
        });
        return total;
    };

    const finalizeAndShowResults = (overrideScore, callback) => {
        const currentScore = overrideScore !== undefined ? overrideScore : calculateCurrentScore();
        setScore(currentScore);

        const totalQ = Math.max(1, getTotalPossibleScore(activeExam));
        const scorePct = Math.round((currentScore / totalQ) * 100);

        const submissionTimestamp = new Date().toISOString();
        const tempDocId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setSubmissionDate(submissionTimestamp);
        setLastSubmissionDocId(tempDocId);

        const newRecord = {
            id: tempDocId,
            score: currentScore,
            total: totalQ,
            scorePct: scorePct,
            date: submissionTimestamp
        };

        setExamHistory(prev => {
            const updated = { ...prev };
            if (!updated[activeExam.id]) updated[activeExam.id] = [];
            updated[activeExam.id].push(newRecord);
            return updated;
        });

        setHighScores(prev => {
            const previousHigh = prev[activeExam.id] !== undefined ? prev[activeExam.id] : -1;
            const newHigh = Math.max(previousHigh, scorePct);
            return { ...prev, [activeExam.id]: newHigh };
        });

        localStorage.removeItem('exam_in_progress');

        if (currentUser) {
            const attemptData = {
                examId: activeExam.id,
                examTitle: activeExam.title || 'Exam',
                collectionSource: activeExam.collectionSource || 'exams',
                score: currentScore,
                total: totalQ,
                scorePct: scorePct,
                date: submissionTimestamp
            };
            db.collection('userHistory').doc(currentUser.uid).collection('attempts').doc(tempDocId).set(attemptData)
                .catch(err => console.error("Error saving attempt to Firestore:", err));
        }

        if (callback) {
            callback();
        } else {
            setCurrentView('results');
            setTimerStatus('finished');
        }
    };

    const isQuestionAnswered = (q) => {
        const ans = answers[q.id];
        if (ans === undefined || ans === null) return false;
        if (typeof ans === 'string') return ans.trim().length > 0;
        if (typeof ans === 'object') return Object.keys(ans).length > 0;
        return Boolean(ans);
    };

    const getUnansweredCount = () => {
        if (!activeExam?.questions) return 0;
        return activeExam.questions.filter(q => !isQuestionAnswered(q)).length;
    };

    const handleSubmitRequest = () => {
        if (getUnansweredCount() > 0 && timeLeft > 0) {
            setShowSubmitConfirmModal(true);
            return;
        }
        if (activeExam.type === 'UAT' && uatSection === 'english') {
            handleStartMath();
        } else {
            handleSubmit();
        }
    };

    const handleSubmit = (callback) => {
        const selfMarkIndices = [];
        const autoWrongOverrides = {};
        (activeExam?.questions || []).forEach((q, idx) => {
            if (q.type === 'short_answer' || q.type === 'fill_blank') {
                const ans = answers[q.id];
                const hasAnswer = typeof ans === 'string' ? ans.trim().length > 0 : Boolean(ans);
                if (!hasAnswer) {
                    autoWrongOverrides[q.id] = false;
                } else {
                    selfMarkIndices.push(idx);
                }
            }
        });

        if (Object.keys(autoWrongOverrides).length > 0) {
            setManualOverrides(prev => ({ ...prev, ...autoWrongOverrides }));
        }

        if (selfMarkIndices.length > 0 && !callback) {
            setTimerStatus('self_marking');
            setSelfMarkQueue(selfMarkIndices);
            setSelfMarkPos(0);
            setCurrentIndex(selfMarkIndices[0]);
            setCurrentView('self_marking');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const finalScore = calculateCurrentScore();
        finalizeAndShowResults(finalScore, callback);
    };

    const getNextUnmarkedPos = (overridesMap, startFromPos) => {
        for (let offset = 1; offset <= selfMarkQueue.length; offset++) {
            const candidatePos = (startFromPos + offset) % selfMarkQueue.length;
            const candId = activeExam?.questions?.[selfMarkQueue[candidatePos]]?.id;
            if (candId !== undefined && overridesMap[candId] === undefined) {
                return candidatePos;
            }
        }
        return -1;
    };

    const handleSelfMarkDecision = (qId, isRight) => {
        const updatedOverrides = { ...manualOverrides, [qId]: isRight };
        setManualOverrides(updatedOverrides);

        if (openedFromConfirm) {
            setOpenedFromConfirm(false);
            setConfirmingGrade(true);
            return;
        }

        const everyQueueItemMarked = selfMarkQueue.every(qIdx => {
            const itemId = activeExam?.questions?.[qIdx]?.id;
            return itemId !== undefined && updatedOverrides[itemId] !== undefined;
        });

        // Never jump to confirmation unless every single item in the queue has been marked
        if (!everyQueueItemMarked) {
            setConfirmingGrade(false);
            const nextUnmarked = getNextUnmarkedPos(updatedOverrides, selfMarkPos);
            const targetPos = nextUnmarked !== -1 ? nextUnmarked : ((selfMarkPos + 1) % selfMarkQueue.length);
            setSelfMarkPos(targetPos);
            setCurrentIndex(selfMarkQueue[targetPos]);
            return;
        }

        // All items are marked: step through the remaining queue items first, then open confirmation
        if (selfMarkPos + 1 < selfMarkQueue.length) {
            setConfirmingGrade(false);
            const nextPos = selfMarkPos + 1;
            setSelfMarkPos(nextPos);
            setCurrentIndex(selfMarkQueue[nextPos]);
        } else {
            setConfirmingGrade(true);
        }
    };

    const handleFlickBackSelfMark = () => {
        if (confirmingGrade) {
            setOpenedFromConfirm(false);
            setConfirmingGrade(false);
            const lastPos = Math.max(0, selfMarkQueue.length - 1);
            setSelfMarkPos(lastPos);
            setCurrentIndex(selfMarkQueue[lastPos]);
            return;
        }
        if (selfMarkPos > 0) {
            setOpenedFromConfirm(false);
            const prevPos = selfMarkPos - 1;
            setSelfMarkPos(prevPos);
            setCurrentIndex(selfMarkQueue[prevPos]);
        }
    };

    const handleJumpToSelfMarkItem = (pos, fromConfirmScreen = false) => {
        if (pos >= 0 && pos < selfMarkQueue.length) {
            setOpenedFromConfirm(Boolean(fromConfirmScreen));
            setConfirmingGrade(false);
            setSelfMarkPos(pos);
            setCurrentIndex(selfMarkQueue[pos]);
        }
    };

    const handleConfirmFinalGrade = () => {
        let finalScore = 0;
        activeExam.questions.forEach(q => {
            finalScore += getQuestionEarnedScore(q, answers[q.id], manualOverrides);
        });
        setConfirmingGrade(false);
        setSelfMarkQueue([]);
        setSelfMarkPos(0);
        finalizeAndShowResults(finalScore);
    };

    const handleToggleOverride = async (qId, status) => {
        const updatedOverrides = { ...manualOverrides, [qId]: status };
        setManualOverrides(updatedOverrides);

        let newScore = 0;
        activeExam.questions.forEach(q => {
            if (updatedOverrides[q.id] !== undefined) {
                if (updatedOverrides[q.id]) newScore++;
            } else {
                if (isQuestionCorrect(q)) newScore++;
            }
        });
        setScore(newScore);

        if (submissionDate && activeExam) {
            const totalQ = getTotalPossibleScore(activeExam);
            const newScorePct = Math.round((newScore / totalQ) * 100);

            setExamHistory(prev => {
                const updated = { ...prev };
                if (updated[activeExam.id]) {
                    updated[activeExam.id] = updated[activeExam.id].map(trial =>
                        trial.date === submissionDate
                            ? { ...trial, score: newScore, total: totalQ, scorePct: newScorePct }
                            : trial
                    );
                }
                return updated;
            });

            setExamHistory(latestHistory => {
                const allTrials = latestHistory[activeExam.id] || [];
                const newHigh = allTrials.length > 0 ? Math.max(...allTrials.map(t => t.scorePct)) : newScorePct;
                setHighScores(prev => ({ ...prev, [activeExam.id]: newHigh }));
                return latestHistory;
            });

            // Update in Firestore
            if (currentUser) {
                try {
                    if (lastSubmissionDocId) {
                        await db.collection('userHistory').doc(currentUser.uid).collection('attempts').doc(lastSubmissionDocId).update({
                            score: newScore,
                            scorePct: newScorePct
                        });
                    } else {
                        const snap = await db.collection('userHistory').doc(currentUser.uid).collection('attempts')
                            .where('examId', '==', activeExam.id)
                            .where('date', '==', submissionDate)
                            .get();
                        if (!snap.empty) {
                            await snap.docs[0].ref.update({ score: newScore, scorePct: newScorePct });
                            setLastSubmissionDocId(snap.docs[0].id);
                        }
                    }
                } catch (err) {
                    console.error("Error updating overridden score in Firestore:", err);
                }
            }
        }
    };

    const handleReset = () => {
        setAnswers({});
        setFlagged({});
        setFlagReasons({});
        setManualOverrides({});
        setSelfMarkQueue([]);
        setSelfMarkPos(0);
        setConfirmingGrade(false);
        setOpenedFromConfirm(false);
        setScore(0);
        setSubmissionDate(null);
        setLastSubmissionDocId(null);
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

    const handleDeleteTrial = async (examId, trialDate, trialDocId) => {
        if (!window.confirm("Are you sure you want to delete this trial record?")) return;

        if (currentUser) {
            try {
                if (trialDocId) {
                    await db.collection('userHistory').doc(currentUser.uid).collection('attempts').doc(trialDocId).delete();
                } else {
                    const snap = await db.collection('userHistory').doc(currentUser.uid).collection('attempts')
                        .where('examId', '==', examId)
                        .where('date', '==', trialDate)
                        .get();
                    snap.docs.forEach(d => d.ref.delete());
                }
            } catch (err) {
                console.error("Error deleting trial from Firestore:", err);
            }
        }

        setExamHistory(prev => {
            const updated = { ...prev };
            if (updated[examId]) {
                updated[examId] = updated[examId].filter(t => t.date !== trialDate && t.id !== trialDocId);
                if (updated[examId].length === 0) {
                    delete updated[examId];
                }
            }

            setHighScores(prevScores => {
                const updatedScores = { ...prevScores };
                if (!updated[examId] || updated[examId].length === 0) {
                    delete updatedScores[examId];
                } else {
                    updatedScores[examId] = Math.max(...updated[examId].map(t => t.scorePct));
                }
                return updatedScores;
            });

            return updated;
        });
    };

    const handleClearAllTrials = async (examId) => {
        if (!window.confirm("Are you sure you want to delete ALL trial history for this exam?")) return;

        if (currentUser) {
            try {
                const snap = await db.collection('userHistory').doc(currentUser.uid).collection('attempts')
                    .where('examId', '==', examId)
                    .get();
                const batch = db.batch();
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
            } catch (err) {
                console.error("Error clearing trials from Firestore:", err);
            }
        }

        setExamHistory(prev => {
            const updated = { ...prev };
            delete updated[examId];
            return updated;
        });

        setHighScores(prev => {
            const updated = { ...prev };
            delete updated[examId];
            return updated;
        });
    };

    const exitToDashboard = () => {
        setActiveExam(null);
        setAnswers({});
        setFlagged({});
        setFlagReasons({});
        setManualOverrides({});
        setSelfMarkQueue([]);
        setSelfMarkPos(0);
        setConfirmingGrade(false);
        setScore(0);
        setCurrentIndex(0);
        setTimerStatus('idle');
        setUatSection(null);
        setSubmissionDate(null);
        setLastSubmissionDocId(null);

        localStorage.removeItem('exam_in_progress');
        setCurrentView('dashboard');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleBackToDashboardClick = () => {
        if (currentView === 'exam') {
            setShowExitConfirmModal(true);
        } else {
            exitToDashboard();
        }
    };

    const handleConfirmExitAndSubmit = () => {
        setShowExitConfirmModal(false);
        handleSubmit(() => {
            exitToDashboard();
        });
    };

    const openExportModal = () => {
        const initialSelected = new Set();
        activeExam.questions.forEach(q => {
            if (!isQuestionCorrect(q) || flagged[q.id]) {
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

    // Sharing handlers
    const handleOpenShareModal = (exam) => {
        setSharingExam(exam);
        setShareVisibility(exam.visibility || 'private');
        setShareWithAdmin(true);
        setShareUserSearch('');
        setShareSearchResults([]);

        const initialUsers = [];
        if (Array.isArray(exam.sharedWith) && Array.isArray(exam.sharedWithUsernames)) {
            exam.sharedWith.forEach((uid, idx) => {
                initialUsers.push({
                    uid: uid,
                    username: exam.sharedWithUsernames[idx] || uid
                });
            });
        }
        setSelectedShareUsers(initialUsers);
    };

    const handleSearchShareUsers = async (query) => {
        setShareUserSearch(query);
        const q = query.trim().toLowerCase();
        if (q.length < 2) {
            setShareSearchResults([]);
            return;
        }
        setIsSearchingUsers(true);
        try {
            const snap = await db.collection('usernames')
                .where('username', '>=', q)
                .where('username', '<=', q + '\uf8ff')
                .limit(8)
                .get();

            const results = [];
            snap.docs.forEach(doc => {
                const data = doc.data();
                if (data.uid !== currentUser?.uid) {
                    results.push({ uid: data.uid, username: data.username });
                }
            });
            setShareSearchResults(results);
        } catch (err) {
            console.error("Error searching usernames:", err);
        } finally {
            setIsSearchingUsers(false);
        }
    };

    const handleToggleQualifyExam = async (exam, nextQualifiedState) => {
        if (!isAdmin || !exam) return;

        if (nextQualifiedState === true) {
            const hasValidQuestions = Array.isArray(exam.questions) && exam.questions.length > 0;
            const hasTitle = Boolean(exam.title && exam.title.trim());
            const hasDuration = Number(exam.durationMinutes) > 0;
            if (!hasTitle || !hasDuration || !hasValidQuestions) {
                alert("Cannot qualify exam: it must have a title, a duration greater than 0, and at least 1 question.");
                return;
            }
        }

        const targetCollection = exam.collectionSource === 'userExams' ? 'userExams' : 'exams';
        try {
            await db.collection(targetCollection).doc(exam.id).set({
                adminQualified: nextQualifiedState,
                qualifiedAt: nextQualifiedState ? firebase.firestore.FieldValue.serverTimestamp() : null,
                qualifiedBy: nextQualifiedState && currentUser ? currentUser.uid : null
            }, { merge: true });

            setExams(prev => prev.map(e => e.id === exam.id ? {
                ...e,
                adminQualified: nextQualifiedState
            } : e));
        } catch (err) {
            console.error("Error updating exam qualification:", err);
            alert("Failed to update qualification status: " + err.message);
        }
    };

    const handleSaveSharing = async () => {
        if (!sharingExam) return;
        setIsSavingShare(true);
        try {
            const sharedUids = selectedShareUsers.map(u => u.uid);
            const sharedUsernames = selectedShareUsers.map(u => u.username);

            // Add admin UID if 'Share with Admin' is checked and admin is not already in list
            let finalUids = [...sharedUids];
            let finalUsernames = [...sharedUsernames];
            if (shareWithAdmin && !finalUids.includes(ADMIN_UID)) {
                finalUids.push(ADMIN_UID);
                finalUsernames.push('admin');
            }

            const targetCollection = sharingExam.collectionSource === 'userExams' ? 'userExams' : 'userExams';
            const updateData = {
                visibility: shareVisibility,
                sharedWith: finalUids,
                sharedWithUsernames: finalUsernames,
                collectionSource: 'userExams'
            };

            // Use set with merge so it works even if doc doesn't exist yet in Firestore
            await db.collection('userExams').doc(sharingExam.id).set(updateData, { merge: true });

            setExams(prev => prev.map(e => e.id === sharingExam.id ? {
                ...e,
                visibility: shareVisibility,
                sharedWith: finalUids,
                sharedWithUsernames: finalUsernames
            } : e));

            setSharingExam(null);
            alert('Sharing settings saved successfully!');
        } catch (err) {
            console.error('Error updating sharing:', err);
            alert('Failed to save sharing settings: ' + err.message);
        } finally {
            setIsSavingShare(false);
        }
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
                                    rows="8"
                                    placeholder={`Type: mcq\nWhat is the derivative of f(x) = 3x^2?\nA) 3x\nB) 6x\nC) x^2\nD) 9x\nAnswer: B\nExplanation: Power rule.\n\nType: true_false\nThe Earth is round.\nAnswer: True\n\nType: fill_blank\nWater boils at _____ degrees Celsius.\nAnswer: 100\n\nType: matching\nMatch the items:\n1. Sun <-> Star\n2. Earth <-> Planet\nAnswer: 1->Star, 2->Planet\n\nType: short_answer\nExplain gravity.\nAnswer: Force that attracts objects.`}
                                    className="w-full border border-gray-300 rounded-lg p-3 font-mono text-xs text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                ></textarea>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={() => handleAddBlock(sectionType)}
                    className="mt-4 w-full py-2.5 border-2 border-dashed border-blue-400 hover:border-blue-600 bg-blue-50/50 hover:bg-blue-100/50 text-blue-800 text-xs font-bold rounded-xl transition-colors flex justify-center items-center gap-2 cursor-pointer"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    Add Another Block
                </button>
            </div>
        );
    };

    const availableSubjects = ['All', ...new Set(exams.map(e => e.subject).filter(Boolean))];

    // Filter exams by active Tab
    const tabFilteredExams = exams.filter(exam => {
        if (selectedAdminUserFilter) {
            return exam.ownerId === selectedAdminUserFilter;
        }
        if (dashboardTab === 'official') {
            return exam.isUniversal || exam.collectionSource === 'exams' || exam.visibility === 'universal';
        }
        if (dashboardTab === 'practice') {
            return isPracticeFromAdmin(exam);
        }
        if (dashboardTab === 'my_exams') {
            return exam.ownerId === currentUser?.uid;
        }
        if (dashboardTab === 'public') {
            const isPublicCandidate = exam.visibility === 'public' && exam.ownerId !== currentUser?.uid;
            if (!isPublicCandidate) return false;
            if (isAdmin && communityFilter === 'pending') {
                return !isExamQualified(exam);
            }
            return isExamQualified(exam);
        }
        if (dashboardTab === 'shared') {
            return Array.isArray(exam.sharedWith) && exam.sharedWith.includes(currentUser?.uid) && exam.ownerId !== currentUser?.uid;
        }
        return exam.isUniversal || exam.collectionSource === 'exams' || exam.visibility === 'universal';
    });

    const filteredExams = tabFilteredExams.filter(exam => {
        const matchesSearch = exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (exam.description && exam.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (exam.subject && exam.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (exam.ownerUsername && exam.ownerUsername.toLowerCase().includes(searchQuery.toLowerCase()));
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
                label: `100%`,
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

    // Calculate tab badge counts
    const pendingPublicCount = exams.filter(
        e => e.visibility === 'public' && e.ownerId !== currentUser?.uid && !isExamQualified(e)
    ).length;

    const tabCounts = {
        official: exams.filter(e => e.isUniversal || e.collectionSource === 'exams' || e.visibility === 'universal').length,
        practice: exams.filter(e => isPracticeFromAdmin(e)).length,
        my_exams: exams.filter(e => e.ownerId === currentUser?.uid).length,
        public: exams.filter(e => e.visibility === 'public' && e.ownerId !== currentUser?.uid && isExamQualified(e)).length,
        pendingPublic: pendingPublicCount,
        shared: exams.filter(e => Array.isArray(e.sharedWith) && e.sharedWith.includes(currentUser?.uid) && e.ownerId !== currentUser?.uid).length
    };

    // Full screen loading indicator while checking auth
    if (authLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-700 font-bold text-sm">Loading Exam Portal...</p>
            </div>
        );
    }

    // Auth screen if not logged in
    if (!currentUser) {
        return <AuthScreen onAuthSuccess={(user, profile) => { setCurrentUser(user); setUserProfile(profile); }} />;
    }

    // Modal to pick username for Google sign-in users
    if (showChooseUsernameModal && googleUserPendingUsername) {
        return (
            <ChooseUsernameModal
                user={googleUserPendingUsername}
                onComplete={(profile) => {
                    setUserProfile(profile);
                    setShowChooseUsernameModal(false);
                    setGoogleUserPendingUsername(null);
                }}
            />
        );
    }

    if (currentView === 'dashboard') {
        return (
            <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8 relative">
                <div className="max-w-6xl mx-auto">
                    {/* Top Navigation Bar with User Profile */}
                    <header className="mb-6 bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-500/20">
                                EP
                            </div>
                            <div>
                                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight leading-tight">Exam Portal</h1>
                                <p className="text-xs text-gray-500">Practice, create, and share comprehensive entrance assessments.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap justify-between sm:justify-end">
                            <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl shadow-xs">
                                <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-700 font-bold text-xs uppercase overflow-hidden shrink-0">
                                    {currentUser?.photoURL ? (
                                        <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        (userProfile?.displayName || userProfile?.username || 'U').charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div className="text-left">
                                    <div className="flex items-center gap-1.5 leading-tight">
                                        <span className="text-xs font-bold text-gray-900 max-w-[130px] sm:max-w-[160px] truncate">
                                            {userProfile?.displayName || userProfile?.username || currentUser?.email}
                                        </span>
                                        {isAdmin && (
                                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-amber-100 text-amber-800 border border-amber-300">
                                                Admin
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-medium">
                                        @{userProfile?.username || 'user'}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setExamDestination(isAdmin ? 'universal' : 'userExam');
                                    setExamVisibility('private');
                                    setShowAddModal(true);
                                }}
                                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition-colors text-xs cursor-pointer"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                                Add Exam
                            </button>

                            <button
                                onClick={() => auth.signOut()}
                                title="Sign Out"
                                className="px-3 py-2 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 font-semibold rounded-xl border border-gray-200 transition-colors text-xs flex items-center gap-1 cursor-pointer"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                                <span className="hidden sm:inline">Sign Out</span>
                            </button>
                        </div>
                    </header>

                    {/* Navigation Tabs */}
                    <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-200">
                        <button
                            onClick={() => { setDashboardTab('official'); setSelectedAdminUserFilter(null); }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${dashboardTab === 'official' && !selectedAdminUserFilter ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                        >
                            <span>Official Exams</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${dashboardTab === 'official' && !selectedAdminUserFilter ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600'}`}>{tabCounts.official}</span>
                        </button>

                        <button
                            onClick={() => { setDashboardTab('practice'); setSelectedAdminUserFilter(null); }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${dashboardTab === 'practice' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                        >
                            <span>Practice Exams</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${dashboardTab === 'practice' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-600'}`}>{tabCounts.practice}</span>
                        </button>

                        <button
                            onClick={() => { setDashboardTab('my_exams'); setSelectedAdminUserFilter(null); }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${dashboardTab === 'my_exams' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                        >
                            <span>My Exams</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${dashboardTab === 'my_exams' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600'}`}>{tabCounts.my_exams}</span>
                        </button>

                        <button
                            onClick={() => { setDashboardTab('public'); setSelectedAdminUserFilter(null); }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${dashboardTab === 'public' ? 'bg-purple-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                        >
                            <span>Community Public</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${dashboardTab === 'public' ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-600'}`}>{tabCounts.public}</span>
                            {isAdmin && tabCounts.pendingPublic > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-900 border border-amber-300">
                                    {tabCounts.pendingPublic} pending
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() => { setDashboardTab('shared'); setSelectedAdminUserFilter(null); }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${dashboardTab === 'shared' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                        >
                            <span>Shared with Me</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${dashboardTab === 'shared' ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600'}`}>{tabCounts.shared}</span>
                        </button>

                        {isAdmin && (
                            <button
                                onClick={() => setDashboardTab('admin_console')}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${dashboardTab === 'admin_console' ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'}`}
                            >
                                <span>Admin Console</span>
                            </button>
                        )}
                    </div>

                    {dashboardTab === 'public' && (
                        <div className="mb-4 p-3 bg-purple-50/70 border border-purple-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="text-purple-900 font-medium">
                                Community Public exams are verified for valid questions, title, and timing before public listing.
                            </span>
                            {isAdmin && (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setCommunityFilter('qualified')}
                                        className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${communityFilter === 'qualified' ? 'bg-purple-600 text-white' : 'bg-white text-purple-800 border border-purple-200'}`}
                                    >
                                        Qualified ({tabCounts.public})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCommunityFilter('pending')}
                                        className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${communityFilter === 'pending' ? 'bg-amber-600 text-white' : 'bg-white text-amber-800 border border-amber-200'}`}
                                    >
                                        Needs Review ({tabCounts.pendingPublic})
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Admin Console View */}
                    {dashboardTab === 'admin_console' && isAdmin && (
                        <div className="mb-6 space-y-5">
                            {/* Metric Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Registered Users</span>
                                        <h3 className="text-2xl font-black text-gray-900 mt-1">{allUsersList.length}</h3>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold">
                                        👥
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Universal Exams</span>
                                        <h3 className="text-2xl font-black text-indigo-600 mt-1">
                                            {exams.filter(e => e.isUniversal || e.collectionSource === 'exams').length}
                                        </h3>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold">
                                        🏛️
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">User Created Exams</span>
                                        <h3 className="text-2xl font-black text-emerald-600 mt-1">
                                            {exams.filter(e => !e.isUniversal && e.collectionSource === 'userExams').length}
                                        </h3>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold">
                                        🗂️
                                    </div>
                                </div>
                            </div>

                            {/* Users Table */}
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
                                    <div>
                                        <h3 className="text-base font-bold text-gray-900">All Portal Users</h3>
                                        <p className="text-xs text-gray-500">View user profiles and filter exams created by individual students.</p>
                                    </div>
                                    <button
                                        onClick={loadAllUsers}
                                        className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                                    >
                                        ↻ Refresh List
                                    </button>
                                </div>

                                {loadingAllUsers ? (
                                    <div className="text-center py-8 text-gray-400 text-xs">Loading registered users...</div>
                                ) : allUsersList.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 text-xs">No registered users found.</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-100 text-left text-xs">
                                            <thead className="bg-gray-50 text-gray-600 uppercase font-semibold text-[10px] tracking-wider">
                                                <tr>
                                                    <th className="px-4 py-3">User</th>
                                                    <th className="px-4 py-3">Username</th>
                                                    <th className="px-4 py-3">Email</th>
                                                    <th className="px-4 py-3">Role</th>
                                                    <th className="px-4 py-3">Exams Created</th>
                                                    <th className="px-4 py-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 text-gray-700">
                                                {allUsersList.map(u => {
                                                    const userExamsCount = exams.filter(e => e.ownerId === u.uid).length;
                                                    const isFilteringThisUser = selectedAdminUserFilter === u.uid;
                                                    return (
                                                        <tr key={u.uid} className={`hover:bg-blue-50/50 transition-colors ${isFilteringThisUser ? 'bg-blue-50' : ''}`}>
                                                            <td className="px-4 py-3 whitespace-nowrap font-bold text-gray-900 flex items-center gap-2">
                                                                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center overflow-hidden">
                                                                    {u.displayName ? u.displayName.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                                                                </div>
                                                                <span>{u.displayName || 'No Name'}</span>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-600">@{u.username}</td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-gray-500">{u.email}</td>
                                                            <td className="px-4 py-3 whitespace-nowrap">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${u.role === 'admin' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-gray-100 text-gray-600'}`}>
                                                                    {u.role || 'user'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap font-bold text-gray-900">{userExamsCount}</td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                                <button
                                                                    onClick={() => {
                                                                        if (isFilteringThisUser) {
                                                                            setSelectedAdminUserFilter(null);
                                                                        } else {
                                                                            setSelectedAdminUserFilter(u.uid);
                                                                        }
                                                                    }}
                                                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${isFilteringThisUser ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                                                                >
                                                                    {isFilteringThisUser ? 'Showing Exams' : 'Filter Exams'}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {selectedAdminUserFilter && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                                    <span className="text-xs font-bold text-blue-900">
                                        Showing exams created by @{allUsersList.find(u => u.uid === selectedAdminUserFilter)?.username || 'user'}:
                                    </span>
                                    <button
                                        onClick={() => setSelectedAdminUserFilter(null)}
                                        className="text-xs text-blue-700 hover:text-blue-900 underline font-semibold cursor-pointer"
                                    >
                                        Clear User Filter
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Search, Subject Filters & Exam Grid (hidden on Admin Console unless filtering a specific user) */}
                    {(dashboardTab !== 'admin_console' || Boolean(selectedAdminUserFilter)) && (
                        <>
                    {/* Search & Subject Filters */}
                    <div className="mb-6 bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
                        <div className="relative w-full sm:flex-1">
                            <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search exams by title, topic, subject, or creator..."
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
                    ) : fetchError ? (
                        <div className="text-center py-12 bg-red-50 rounded-xl border border-red-200 p-8 shadow-sm">
                            <p className="text-red-700 font-bold text-base mb-1">Failed to load exams from Firebase</p>
                            <p className="text-red-500 font-mono text-xs mb-3">{fetchError}</p>
                            <p className="text-gray-600 text-xs">Ensure your Firestore Security Rules permit read access.</p>
                        </div>
                    ) : filteredExams.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 p-8">
                            <p className="text-gray-500 mb-4">No matching exams found in this view.</p>
                            <button onClick={() => { setSearchQuery(''); setSelectedSubjectFilter('All'); setDashboardTab('official'); setCommunityFilter('qualified'); setSelectedAdminUserFilter(null); }} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300 cursor-pointer">Clear Filters</button>
                        </div>
                    ) : (
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                            {filteredExams.map((exam) => {
                                const topScorePct = highScores[exam.id];
                                const styling = getExamGradeStyling(topScorePct);

                                const isExamOwner = exam.ownerId === currentUser?.uid;
                                const canEdit = (exam.isUniversal && isAdmin) || (exam.collectionSource === 'userExams' && (isExamOwner || isAdmin));
                                const canDelete = (exam.isUniversal && isAdmin) || (exam.collectionSource === 'userExams' && (isExamOwner || isAdmin));
                                const canShare = !exam.isUniversal && (isExamOwner || isAdmin);

                                return (
                                    <div
                                        key={exam.id}
                                        className={`rounded-xl border transition-all duration-200 flex flex-col justify-between p-3.5 relative group aspect-[2/1] min-h-[115px] ${styling.cardBg}`}
                                    >
                                        <div className="flex flex-wrap justify-between items-start gap-2 mb-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {/* Origin / Ownership Badge */}
                                                {exam.isUniversal ? (
                                                    <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider bg-indigo-100 text-indigo-800 uppercase border border-indigo-200">
                                                        🏛️ Universal
                                                    </span>
                                                ) : isExamOwner ? (
                                                    <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider bg-blue-100 text-blue-800 uppercase border border-blue-200">
                                                        {exam.visibility === 'public' ? 'My Public Exam' : (exam.sharedWith && exam.sharedWith.length > 0 ? `👥 Shared (${exam.sharedWith.length})` : 'My Private Exam')}
                                                    </span>
                                                ) : (exam.sharedWith && exam.sharedWith.includes(currentUser?.uid)) ? (
                                                    <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider bg-emerald-100 text-emerald-800 uppercase border border-emerald-200">
                                                        📨 Shared by @{exam.ownerUsername || 'user'}
                                                    </span>
                                                ) : (
                                                    <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider bg-purple-100 text-purple-800 uppercase border border-purple-200">
                                                        🌐 by @{exam.ownerUsername || 'user'}
                                                    </span>
                                                )}

                                                {exam.subject && (exam.type !== 'UAT' || exam.subject.toUpperCase() !== 'UAT') && (
                                                    <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-gray-100 text-gray-700 uppercase border border-gray-200">
                                                        {exam.subject}
                                                    </span>
                                                )}

                                                {exam.type === 'UAT' && (
                                                    <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-purple-100 text-purple-800 uppercase border border-purple-200">
                                                        UAT
                                                    </span>
                                                )}

                                                {styling.label && (
                                                    <span
                                                        className={styling.badgeClass}
                                                        title="Your Highest Score"
                                                        style={{ background: styling.gradient }}
                                                    >
                                                        Score: {styling.label}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Action Icons */}
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => setSelectedExamStats(exam)} title="Exam Info & Your History" className="p-1 text-gray-400 hover:text-blue-600 transition-colors cursor-pointer">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                </button>

                                                {canShare && (
                                                    <button onClick={() => handleOpenShareModal(exam)} title="Share Exam with Users" className="p-1 text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                                                    </button>
                                                )}

                                                {canEdit && (
                                                    <button onClick={() => handleOpenEditModal(exam)} title="Edit Exam & Questions" className="p-1 text-gray-400 hover:text-blue-600 transition-colors cursor-pointer">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                                    </button>
                                                )}

                                                {canDelete && (
                                                    <button onClick={() => setExamToDelete(exam)} title="Delete Exam Set" className="p-1 text-gray-400 hover:text-red-600 transition-colors cursor-pointer">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                    </button>
                                                )}
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
                                            <button onClick={() => handleSelectExam(exam)} className="px-3.5 py-1 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-md transition-colors shadow-sm cursor-pointer">
                                                Start Exam
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Exam Info & History Modal */}
                    {selectedExamStats && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
                            <div className="bg-white rounded-xl shadow-2xl flex flex-col max-w-2xl w-full max-h-[90vh] overflow-hidden">
                                <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                    <h3 className="text-xl font-bold text-gray-900">Exam Info & Your History</h3>
                                    <button onClick={() => setSelectedExamStats(null)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                </div>
                                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-lg font-bold text-gray-800">{selectedExamStats.title}</h4>
                                            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800">
                                                {selectedExamStats.isUniversal ? 'Universal' : `by @${selectedExamStats.ownerUsername || 'user'}`}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1">{selectedExamStats.description || 'No description provided.'}</p>
                                        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                                            <div><span className="font-semibold text-gray-700">Subject:</span> {selectedExamStats.subject}</div>
                                            <div><span className="font-semibold text-gray-700">Duration:</span> {selectedExamStats.durationMinutes} mins</div>
                                            <div><span className="font-semibold text-gray-700">Total Questions:</span> {selectedExamStats.questions?.length || 0}</div>
                                            <div><span className="font-semibold text-gray-700">Type:</span> {selectedExamStats.type}</div>
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 pt-3 border-t">
                                            <input
                                                type="checkbox"
                                                id="shuffleToggle"
                                                checked={selectedExamStats.shuffleQuestions !== false}
                                                onChange={async (e) => {
                                                    const newVal = e.target.checked;
                                                    const updated = { ...selectedExamStats, shuffleQuestions: newVal };
                                                    setSelectedExamStats(updated);
                                                    setExams(prev => prev.map(ex => ex.id === updated.id ? updated : ex));
                                                    const targetCol = updated.collectionSource === 'userExams' ? 'userExams' : 'exams';
                                                    try {
                                                        await db.collection(targetCol).doc(updated.id).update({ shuffleQuestions: newVal });
                                                    } catch (err) { console.error(err); }
                                                }}
                                                className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer"
                                            />
                                            <label htmlFor="shuffleToggle" className="text-sm font-medium text-gray-700 cursor-pointer">Shuffle Questions on Start</label>
                                        </div>
                                    </div>

                                    {/* Trial History for this user only */}
                                    <div className="border-t pt-4">
                                        <div className="flex justify-between items-center mb-3">
                                            <div>
                                                <h4 className="font-bold text-gray-800">Your Trial History</h4>
                                                <p className="text-xs text-gray-500">Only visible to your account. Synced securely to your profile.</p>
                                            </div>
                                            {examHistory[selectedExamStats.id] && examHistory[selectedExamStats.id].length > 0 && (
                                                <button
                                                    onClick={() => handleClearAllTrials(selectedExamStats.id)}
                                                    className="text-xs px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-800 font-semibold rounded-lg border border-red-200 transition-colors cursor-pointer"
                                                >
                                                    Clear All History
                                                </button>
                                            )}
                                        </div>

                                        {(!examHistory[selectedExamStats.id] || examHistory[selectedExamStats.id].length === 0) ? (
                                            <p className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded-xl text-center border border-dashed border-gray-200">No trials recorded yet. Click "Start Exam" to take your first test!</p>
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
                                                                                onClick={() => handleDeleteTrial(selectedExamStats.id, trial.date, trial.id)}
                                                                                className="text-gray-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
                                                                                title="Delete Trial Record"
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
                                    <button onClick={() => setSelectedExamStats(null)} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 cursor-pointer">Close</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Share Modal */}
                    {sharingExam && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
                            <div className="bg-white rounded-2xl shadow-2xl flex flex-col max-w-lg w-full max-h-[90vh] overflow-hidden">
                                <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                    <div className="flex items-center gap-2">

                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">Share Exam</h3>
                                            <p className="text-xs text-gray-500 truncate max-w-xs">{sharingExam.title}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setSharingExam(null)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                </div>

                                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                                    {/* Visibility Option */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-800 mb-2 uppercase tracking-wide">
                                            Exam Visibility
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <label className={`flex flex-col p-3 border rounded-xl cursor-pointer transition-all ${shareVisibility === 'private' ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <input
                                                        type="radio"
                                                        name="shareVis"
                                                        checked={shareVisibility === 'private'}
                                                        onChange={() => setShareVisibility('private')}
                                                        className="text-blue-600 cursor-pointer"
                                                    />
                                                    <span className="text-xs font-bold text-gray-900">Private & Shared</span>
                                                </div>
                                                <span className="text-[11px] text-gray-500">Only you and specifically selected users can access.</span>
                                            </label>
                                            <label className={`flex flex-col p-3 border rounded-xl cursor-pointer transition-all ${shareVisibility === 'public' ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <input
                                                        type="radio"
                                                        name="shareVis"
                                                        checked={shareVisibility === 'public'}
                                                        onChange={() => setShareVisibility('public')}
                                                        className="text-blue-600 cursor-pointer"
                                                    />
                                                    <span className="text-xs font-bold text-gray-900">Public Community</span>
                                                </div>
                                                <span className="text-[11px] text-gray-500">Visible to all registered students on the portal.</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Share with Admin Checkbox */}
                                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                                        <label className="flex items-start gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={shareWithAdmin}
                                                onChange={(e) => setShareWithAdmin(e.target.checked)}
                                                className="mt-0.5 text-amber-600 rounded cursor-pointer"
                                            />
                                            <div>
                                                <span className="text-xs font-bold text-amber-900">Share with Admin</span>
                                                <p className="text-[11px] text-amber-700">Allows portal administrator to inspect and assist with this exam.</p>
                                            </div>
                                        </label>
                                    </div>

                                    {/* User Search & Add */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">
                                            Share with Specific Users by Username
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-400 font-bold text-xs">@</span>
                                            <input
                                                type="text"
                                                value={shareUserSearch}
                                                onChange={(e) => handleSearchShareUsers(e.target.value)}
                                                placeholder="Type a username to search (e.g. alex_smith)..."
                                                className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>

                                        {isSearchingUsers && (
                                            <div className="mt-2 text-xs text-gray-400 font-medium py-1">Searching usernames...</div>
                                        )}
                                        {shareSearchResults.length > 0 && (
                                            <div className="mt-2 border border-gray-200 rounded-xl bg-white shadow-md divide-y divide-gray-100 max-h-40 overflow-y-auto">
                                                {shareSearchResults.map(u => {
                                                    const isAlreadyAdded = selectedShareUsers.some(su => su.uid === u.uid);
                                                    return (
                                                        <div key={u.uid} className="p-2.5 flex items-center justify-between hover:bg-blue-50 transition-colors">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center">
                                                                    {u.username.charAt(0).toUpperCase()}
                                                                </div>
                                                                <span className="text-xs font-bold text-gray-800">@{u.username}</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                disabled={isAlreadyAdded}
                                                                onClick={() => {
                                                                    if (!isAlreadyAdded) {
                                                                        setSelectedShareUsers(prev => [...prev, u]);
                                                                        setShareUserSearch('');
                                                                        setShareSearchResults([]);
                                                                    }
                                                                }}
                                                                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${isAlreadyAdded ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                                            >
                                                                {isAlreadyAdded ? 'Added' : '+ Add'}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Currently Shared Users List */}
                                        <div className="mt-3">
                                            <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wide block mb-1.5">
                                                Users with Access ({selectedShareUsers.length})
                                            </span>
                                            {selectedShareUsers.length === 0 ? (
                                                <div className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-xl border border-dashed border-gray-200 text-center">
                                                    No specific users added yet. Search above to grant access.
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedShareUsers.map(u => (
                                                        <span key={u.uid} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-full text-xs font-semibold">
                                                            @{u.username}
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedShareUsers(prev => prev.filter(item => item.uid !== u.uid))}
                                                                className="w-4 h-4 rounded-full hover:bg-blue-200 text-blue-600 hover:text-blue-900 flex items-center justify-center text-[10px] cursor-pointer"
                                                            >
                                                                ✕
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setSharingExam(null)}
                                        className="px-4 py-2 border rounded-xl text-gray-700 text-xs font-semibold hover:bg-gray-100 cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveSharing}
                                        disabled={isSavingShare}
                                        className={`px-5 py-2 text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer ${isSavingShare ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                                    >
                                        {isSavingShare ? 'Saving...' : 'Save Sharing Settings'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Add Exam Modal */}
                    {showAddModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
                            <div className="bg-white rounded-xl shadow-2xl flex flex-col max-w-5xl w-full max-h-[92vh] overflow-hidden">
                                <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">Add New Exam (Block Builder)</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <p className="text-xs text-gray-500">Configure exam details and organize questions into extendable passage blocks.</p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const sampleText = `Type: mcq\nWhat is the derivative of f(x) = 3x^2?\nA) 3x\nB) 6x\nC) x^2\nD) 9x\nAnswer: B\nExplanation: Power rule.\n\nType: true_false\nThe Earth is round.\nAnswer: True\n\nType: fill_blank\nWater boils at _____ degrees Celsius.\nAnswer: 100\n\nType: matching\nMatch the items:\n1. Sun <-> Star\n2. Earth <-> Planet\nAnswer: 1->Star, 2->Planet\n\nType: short_answer\nExplain gravity.\nAnswer: Force that attracts objects.`;
                                                    navigator.clipboard.writeText(sampleText).then(() => {
                                                        alert("Sample exam format copied to clipboard!");
                                                    });
                                                }}
                                                className="text-xs px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold rounded border border-purple-200 transition-colors cursor-pointer"
                                            >
                                                📋 Copy AI Format Sample
                                            </button>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                </div>

                                <div className="p-6 overflow-y-auto flex-1">
                                    {/* Admin Choice: Universal Exam vs User Exam */}
                                    {isAdmin && (
                                        <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                                            <label className="block text-xs font-bold text-indigo-900 mb-1.5 uppercase tracking-wide">
                                                Exam Destination & Audience
                                            </label>
                                            <div className="flex flex-wrap gap-4 text-xs font-bold">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="examDest"
                                                        checked={examDestination === 'universal'}
                                                        onChange={() => setExamDestination('universal')}
                                                        className="text-indigo-600"
                                                    />
                                                    <span className="text-indigo-950">Universal Exam (Visible to ALL students, editable only by Admin)</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="examDest"
                                                        checked={examDestination === 'userExam'}
                                                        onChange={() => setExamDestination('userExam')}
                                                        className="text-indigo-600"
                                                    />
                                                    <span className="text-gray-800">Personal Exam (Created under your account)</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* Non-Admin or Admin-Personal Visibility Choice */}
                                    {(!isAdmin || examDestination === 'userExam') && (
                                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                            <label className="block text-xs font-bold text-blue-900 mb-1.5 uppercase tracking-wide">
                                                Initial Exam Visibility
                                            </label>
                                            <div className="flex flex-wrap gap-4 text-xs font-bold">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="examVis"
                                                        checked={examVisibility === 'private'}
                                                        onChange={() => setExamVisibility('private')}
                                                        className="text-blue-600"
                                                    />
                                                    <span className="text-gray-800">Private (Only visible to you; shareable later)</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="examVis"
                                                        checked={examVisibility === 'public'}
                                                        onChange={() => setExamVisibility('public')}
                                                        className="text-blue-600"
                                                    />
                                                    <span className="text-gray-800">Public - Visible to all students in the Community tab)</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

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
                                                        className="px-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold rounded border border-blue-200 text-xs cursor-pointer"
                                                    >+</button>
                                                )}
                                            </div>
                                        </div>

                                        {examType !== 'UAT' && (
                                            <div className="md:col-span-3 lg:col-span-2 bg-white p-3 rounded-lg border border-blue-200 shadow-sm space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-blue-900">Timer Settings</span>
                                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={useDefaultTimer}
                                                            onChange={(e) => setUseDefaultTimer(e.target.checked)}
                                                            className="rounded text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span>Default Exam Timing</span>
                                                    </label>
                                                </div>

                                                {useDefaultTimer ? (
                                                    <p className="text-[11px] text-gray-600 bg-blue-50 p-2 rounded border border-blue-100 leading-tight">
                                                        ✨ Standard entrance rate for <strong className="text-blue-800">{examSubject || 'this subject'}</strong> ({SUBJECT_TIME_PER_QUESTION[examSubject] || SUBJECT_TIME_PER_QUESTION['Default']} min/Q) multiplied by question count.
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2 pt-1">
                                                        <div className="flex gap-3 text-[11px] font-semibold text-gray-700">
                                                            <label className="flex items-center gap-1 cursor-pointer">
                                                                <input
                                                                    type="radio"
                                                                    name="timerMode"
                                                                    checked={customTimerMode === 'perQuestion'}
                                                                    onChange={() => setCustomTimerMode('perQuestion')}
                                                                    className="text-blue-600"
                                                                />
                                                                Per Min / Question
                                                            </label>
                                                            <label className="flex items-center gap-1 cursor-pointer">
                                                                <input
                                                                    type="radio"
                                                                    name="timerMode"
                                                                    checked={customTimerMode === 'plainTotal'}
                                                                    onChange={() => setCustomTimerMode('plainTotal')}
                                                                    className="text-blue-600"
                                                                />
                                                                Plain Total Time
                                                            </label>
                                                        </div>

                                                        {customTimerMode === 'perQuestion' ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[11px] text-gray-600">Mins per question:</span>
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    min="0.1"
                                                                    value={customMinsPerQuestion}
                                                                    onChange={(e) => setCustomMinsPerQuestion(e.target.value)}
                                                                    className="w-16 border border-gray-300 rounded p-1 text-xs font-bold text-center outline-none focus:ring-1 focus:ring-blue-500"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1 text-xs text-gray-700 font-mono">
                                                                <span>H:</span>
                                                                <input type="number" min="0" value={plainHours} onChange={(e) => setPlainHours(e.target.value)} className="w-10 border rounded p-1 text-center text-xs" />
                                                                <span>M:</span>
                                                                <input type="number" min="0" max="59" value={plainMinutes} onChange={(e) => setPlainMinutes(e.target.value)} className="w-10 border rounded p-1 text-center text-xs" />
                                                                <span>S:</span>
                                                                <input type="number" min="0" max="59" value={plainSeconds} onChange={(e) => setPlainSeconds(e.target.value)} className="w-10 border rounded p-1 text-center text-xs" />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
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
                                    <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-md text-gray-700 text-sm font-medium hover:bg-gray-100 cursor-pointer">Cancel</button>
                                    <button
                                        onClick={handleSaveExamToFirestore}
                                        disabled={isSavingExam}
                                        className={`px-6 py-2 text-white text-sm font-bold rounded-md shadow transition-colors cursor-pointer ${isSavingExam ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                                    >
                                        {isSavingExam ? 'Saving Exam...' : 'Save & Publish Exam'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Edit Exam Modal */}
                    {editingExam && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
                            <div className="bg-white rounded-xl shadow-2xl flex flex-col max-w-4xl w-full max-h-[90vh] overflow-hidden">
                                <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                    <h3 className="text-xl font-bold text-gray-900">Edit Exam & Questions</h3>
                                    <button onClick={() => setEditingExam(null)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
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
                                            <button onClick={handleAddQuestionToEdit} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded flex items-center gap-1 cursor-pointer">
                                                + Add Question
                                            </button>
                                        </div>

                                        <div className="space-y-6 max-h-[40vh] overflow-y-auto pr-2">
                                            {editQuestions.map((q, qIdx) => (
                                                <div key={qIdx} className="p-4 border rounded-lg bg-gray-50 space-y-3 relative">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-gray-800 text-sm">Question {qIdx + 1}</span>
                                                        <button onClick={() => handleDeleteQuestionFromEdit(qIdx)} className="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer">
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

                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-3">
                                                            <label className="text-xs font-semibold text-gray-700">Question Type:</label>
                                                            <select
                                                                value={q.type || 'mcq'}
                                                                onChange={(e) => handleUpdateQuestionField(qIdx, 'type', e.target.value)}
                                                                className="border rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                            >
                                                                <option value="mcq">Multiple Choice (MCQ)</option>
                                                                <option value="true_false">True / False</option>
                                                                <option value="fill_blank">Fill in the Blank</option>
                                                                <option value="short_answer">Short Answer</option>
                                                                <option value="matching">Matching Pairs</option>
                                                            </select>
                                                        </div>

                                                        {(q.type === 'mcq' || !q.type || q.type === 'true_false') && (
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
                                                        )}

                                                        {q.type === 'fill_blank' && (
                                                            <div className="p-2 bg-white border rounded text-xs text-gray-600">
                                                                <span>Expected Answer (use `|` for alternative synonyms):</span>
                                                                <input
                                                                    type="text"
                                                                    value={q.correctAnswer || ''}
                                                                    onChange={(e) => handleUpdateQuestionField(qIdx, 'correctAnswer', e.target.value)}
                                                                    className="w-full mt-1 border rounded p-1 text-xs"
                                                                    placeholder="e.g. photosynthesis | photo-synthesis"
                                                                />
                                                            </div>
                                                        )}

                                                        {q.type === 'short_answer' && (
                                                            <div className="p-2 bg-white border rounded text-xs text-gray-600">
                                                                <span>Reference Answer / Grading Key:</span>
                                                                <textarea
                                                                    value={q.correctAnswer || ''}
                                                                    onChange={(e) => handleUpdateQuestionField(qIdx, 'correctAnswer', e.target.value)}
                                                                    className="w-full mt-1 border rounded p-1 text-xs"
                                                                    rows="2"
                                                                    placeholder="Model answer..."
                                                                />
                                                            </div>
                                                        )}

                                                        {q.type === 'matching' && (
                                                            <div className="p-2 bg-white border rounded text-xs space-y-2">
                                                                <span className="font-bold text-gray-700">Matching Pairs:</span>
                                                                {(q.pairs || []).map((pair, pIdx) => (
                                                                    <div key={pair.id || pIdx} className="flex items-center gap-2">
                                                                        <span className="font-semibold text-gray-600">{pair.id}.</span>
                                                                        <input
                                                                            type="text"
                                                                            value={pair.left}
                                                                            onChange={(e) => {
                                                                                const newPairs = [...(q.pairs || [])];
                                                                                newPairs[pIdx].left = e.target.value;
                                                                                handleUpdateQuestionField(qIdx, 'pairs', newPairs);
                                                                            }}
                                                                            className="border rounded p-1 text-xs flex-1"
                                                                            placeholder="Left item"
                                                                        />
                                                                        <span>&lt;-&gt;</span>
                                                                        <input
                                                                            type="text"
                                                                            value={pair.right}
                                                                            onChange={(e) => {
                                                                                const newPairs = [...(q.pairs || [])];
                                                                                newPairs[pIdx].right = e.target.value;
                                                                                handleUpdateQuestionField(qIdx, 'pairs', newPairs);
                                                                            }}
                                                                            className="border rounded p-1 text-xs flex-1"
                                                                            placeholder="Right option"
                                                                        />
                                                                    </div>
                                                                ))}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newPairs = [...(q.pairs || []), { id: String((q.pairs || []).length + 1), left: '', right: '' }];
                                                                        handleUpdateQuestionField(qIdx, 'pairs', newPairs);
                                                                    }}
                                                                    className="px-2 py-1 bg-blue-50 text-blue-700 font-bold rounded text-[11px] cursor-pointer"
                                                                >
                                                                    + Add Pair
                                                                </button>
                                                            </div>
                                                        )}
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
                                    <button onClick={() => setEditingExam(null)} className="px-4 py-2 border rounded-md text-gray-700 text-sm font-medium hover:bg-gray-100 cursor-pointer">Cancel</button>
                                    <button
                                        onClick={handleSaveEditedExam}
                                        disabled={isUpdatingExam}
                                        className={`px-5 py-2 text-white text-sm font-bold rounded-md shadow transition-colors cursor-pointer ${isUpdatingExam ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                                    >
                                        {isUpdatingExam ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    </>
                    )}

                    {/* Delete Exam Confirmation Modal */}
                    {examToDelete && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Entire Exam Set?</h3>
                                <p className="text-sm text-gray-600 mb-6">
                                    Are you sure you want to delete <span className="font-bold text-gray-900">"{examToDelete.title}"</span>? This action cannot be undone.
                                </p>
                                <div className="flex justify-end gap-3">
                                    <button onClick={() => setExamToDelete(null)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium cursor-pointer">Cancel</button>
                                    <button
                                        onClick={handleConfirmDelete}
                                        disabled={isDeleting}
                                        className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md text-sm font-medium cursor-pointer"
                                    >
                                        {isDeleting ? 'Deleting...' : 'Delete Exam'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <FeedbackAndAdminFixesWidget currentUser={currentUser} userProfile={userProfile} isAdmin={isAdmin} activeExamTitle={activeExam?.title} />
            </div>
        );
    }


    const isSelfMarking = currentView === 'self_marking';
    const isSubmitted = currentView === 'results';
    const isExamLocked = isSelfMarking || isSubmitted;
    const question = activeExam.questions[currentIndex] || activeExam.questions[0];

    const renderQuestionButton = (q, idx) => {
        const isAnswered = !!answers[q.id];
        const isFlagged = !!flagged[q.id];
        const isActive = currentIndex === idx;
        let bgClass = "bg-white text-gray-600 border-gray-300 hover:bg-gray-50";

        if (isSubmitted) {
            if (!answers[q.id]) bgClass = "bg-gray-100 text-gray-500 border-gray-300";
            else if (isQuestionCorrect(q)) bgClass = "bg-green-100 text-green-800 border-green-400";
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
            if (isQuestionCorrect(q)) {
                if (idx < 55) englishScore++;
                else mathScore++;
            }
        });
    }

    let isPrevDisabled = false;
    let isNextDisabled = false;
    if (isSelfMarking) {
        isPrevDisabled = true;
        isNextDisabled = true;
    } else if (activeExam?.type === 'UAT' && !isSubmitted) {
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

    const totalPossible = activeExam?.questions ? getTotalPossibleScore(activeExam) : 1;
    const finalScorePct = activeExam?.questions?.length ? Math.round((score / totalPossible) * 100) : 0;
    const scoreColorClass = finalScorePct === 100 ? "text-yellow-500" : finalScorePct >= 95 ? "text-emerald-600" : finalScorePct >= 90 ? "text-amber-500" : "text-rose-600";
    const displayScoreText = finalScorePct === 100 ? (
        <span><span className="animate-crown">👑</span> 100%</span>
    ) : `${finalScorePct}%`;

    return (
        <div className="min-h-screen py-4 px-4 sm:px-6 lg:px-8 relative pb-20">

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

            {showSubmitConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-green-100 text-green-600 flex items-center justify-center font-bold text-xl">
                            ✓
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Unanswered Questions Remaining</h3>
                        <p className="text-xs text-gray-600 text-center mb-6 leading-relaxed">
                            You still have <strong className="text-gray-900">{getUnansweredCount()}</strong> unanswered {getUnansweredCount() === 1 ? 'question' : 'questions'}. Submit anyway?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowSubmitConfirmModal(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold cursor-pointer"
                            >
                                Continue Exam
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowSubmitConfirmModal(false);
                                    if (activeExam.type === 'UAT' && uatSection === 'english') {
                                        handleStartMath();
                                    } else {
                                        handleSubmit();
                                    }
                                }}
                                className="px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-xl text-xs font-bold shadow transition-colors cursor-pointer"
                            >
                                Yes, Submit Now
                            </button>
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
                            <button onClick={() => setShowExitConfirmModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium">Cancel</button>
                            <button onClick={handleConfirmExitAndSubmit} className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md font-medium">Yes, Submit & Exit</button>
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
                                    const isWrong = !isQuestionCorrect(q);
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

            {isSelfMarking && (
                <div
                    className="fixed inset-0 z-30 bg-gray-900/15 backdrop-blur-[3px] transition-all duration-200 select-none"
                    aria-hidden="true"
                />
            )}

            <div className="max-w-7xl mx-auto">
                <div className={`mb-4 transition-all duration-200 ${isSelfMarking ? 'blur-[2px] opacity-65 pointer-events-none select-none' : ''}`}>
                    <button onClick={handleBackToDashboardClick} className="text-sm font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        Back to Dashboard
                    </button>
                </div>

                <div className={`fixed bottom-6 right-6 sm:top-6 sm:right-8 sm:bottom-auto z-40 flex-shrink-0 transition-all duration-200 ${isSelfMarking ? 'blur-[2px] opacity-65 pointer-events-none select-none' : ''}`}>
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

                <header className={`mb-6 text-center mt-2 border-b border-gray-200 pb-4 transition-all duration-200 ${isSelfMarking ? 'blur-[2px] opacity-65 pointer-events-none select-none' : ''}`}>
                    <h1 className="text-3xl sm:text-4xl font-bold text-[#111827] mb-2">{activeExam.title}</h1>
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">{activeExam.subject}</span>
                </header>
                <div className="flex flex-col lg:flex-row gap-6 relative">
                    <aside className={`w-full lg:w-72 shrink-0 lg:sticky lg:top-6 h-fit bg-white rounded-lg border border-gray-200 shadow-sm p-4 order-2 lg:order-1 transition-all duration-200 ${isSelfMarking ? 'blur-[2px] opacity-65 pointer-events-none select-none' : ''}`}>
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
                                    <button type="button" onClick={handleSubmitRequest} className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm cursor-pointer">
                                        Submit English & Start Math
                                    </button>
                                ) : (
                                    <button type="button" onClick={handleSubmitRequest} className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm cursor-pointer">
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

                    <main className={isSelfMarking ? 'fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6 pointer-events-none' : 'flex-1 order-1 lg:order-2'}>
                        <div className={`bg-[#f9fafb] border border-gray-200/90 rounded-xl p-5 sm:p-7 shadow-lg flex flex-col justify-between transition-all duration-200 ${isSelfMarking ? 'w-full max-w-2xl max-h-[88vh] overflow-y-auto pointer-events-auto bg-white/95 border-gray-200 shadow-xl' : 'min-h-[400px]'}`}>
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
                                            <span className="font-bold mr-2">{currentIndex + 1}.</span>
                                            {question.type === 'fill_blank' ? renderFillBlankText(question.text, answers[question.id]) : <MathText text={question.text} />}
                                        </div>
                                    </div>
                                    {!isExamLocked && (
                                        <button onClick={() => toggleFlag(question.id)} className={`p-1.5 rounded-md transition-colors group ${flagged[question.id] ? "text-red-500 fill-red-500" : "text-gray-400 hover:text-gray-600 fill-none"}`}>
                                            <svg className="w-7 h-7" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-4 pl-0 sm:pl-6 transition-all duration-300">
                                    {(!question.type || question.type === 'mcq') && question.options.map((option) => {
                                        const isSelected = answers[question.id] === option.id;
                                        const isCorrect = option.id === question.correctAnswer;
                                        let labelClass = "flex items-start p-3 border rounded-lg transition-colors w-full " +
                                            (isSubmitted ? (isCorrect ? "bg-green-50 border-green-300 cursor-pointer" : (isSelected ? "bg-red-50 border-red-300 cursor-pointer" : "bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed"))
                                                : isSelfMarking ? (isSelected ? "bg-blue-50/70 border-blue-200 cursor-default" : "bg-gray-50 border-gray-200 opacity-65 cursor-default")
                                                : (isSelected ? "bg-blue-50 border-blue-300 cursor-pointer" : "bg-white border-gray-200 hover:bg-gray-50 cursor-pointer"));

                                        return (
                                            <label key={option.id} className={labelClass}>
                                                <div className="flex items-center h-6 mt-0.5 shrink-0">
                                                    <input type="radio" checked={isSelected} onChange={() => handleOptionSelect(question.id, option.id)} disabled={isExamLocked} className="w-5 h-5 text-blue-600 bg-white border-gray-300 cursor-pointer" />
                                                </div>
                                                <span className={`ml-3 text-base mt-0.5 w-full ${isSubmitted ? (isCorrect ? "text-green-800 font-medium" : (isSelected ? "text-red-800 font-medium" : "text-gray-700")) : "text-gray-700"}`}>
                                                    <span className="font-semibold mr-1">{option.id}.</span> <MathText text={option.text} />
                                                </span>
                                            </label>
                                        );
                                    })}

                                    {question.type === 'true_false' && (
                                        <div className="grid grid-cols-2 gap-4 my-4">
                                            {['True', 'False'].map((val) => {
                                                const isSelected = answers[question.id] === val;
                                                const isCorrect = val === question.correctAnswer;
                                                let btnStyle = "flex items-center justify-center gap-3 p-4 rounded-xl border-2 font-bold text-base transition-all cursor-pointer shadow-sm ";
                                                if (isSubmitted) {
                                                    if (isCorrect) btnStyle += "bg-green-50 border-green-300 text-green-900";
                                                    else if (isSelected) btnStyle += "bg-red-50 border-red-300 text-red-900";
                                                    else btnStyle += "bg-gray-50 border-gray-200 text-gray-400 opacity-60 cursor-not-allowed";
                                                } else {
                                                    if (isSelected) btnStyle += "bg-blue-50 border-blue-300 text-blue-900 shadow-sm";
                                                    else btnStyle += "bg-white border-gray-200 hover:bg-gray-50 text-gray-800";
                                                }

                                                return (
                                                    <button
                                                        key={val}
                                                        type="button"
                                                        disabled={isSubmitted}
                                                        onClick={() => handleOptionSelect(question.id, val)}
                                                        className={btnStyle}
                                                    >
                                                        {val === 'True' ? (
                                                            <span className="text-base">✓ True</span>
                                                        ) : (
                                                            <span className="text-base">✗ False</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {question.type === 'fill_blank' && (
                                        <div className="space-y-3">
                                            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide">Type answer for the blank space:</label>
                                            <input
                                                type="text"
                                                disabled={isExamLocked}
                                                readOnly={isExamLocked}
                                                value={answers[question.id] || ''}
                                                onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                                                placeholder="Type your answer here..."
                                                className={`w-full border-2 rounded-lg p-3 text-base outline-none font-semibold text-gray-900 shadow-sm ${isExamLocked ? 'border-gray-200 bg-gray-100/80 text-gray-700 cursor-default' : 'border-blue-300 focus:border-blue-600 bg-white'}`}
                                            />
                                            {isSubmitted && (
                                                <div className="text-sm font-semibold mt-2">
                                                    <span className="text-gray-600">Your Answer: </span>
                                                    <span className={isQuestionCorrect(question) ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
                                                        {answers[question.id] || '(Blank)'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {question.type === 'short_answer' && (
                                        <div className="space-y-3">
                                            <textarea
                                                disabled={isExamLocked}
                                                readOnly={isExamLocked}
                                                rows={Math.max(2, Math.min(14, String(answers[question.id] || '').split('\n').length + Math.ceil(String(answers[question.id] || '').length / 68)))}
                                                value={answers[question.id] || ''}
                                                onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                                                placeholder="Type your answer or explanation here..."
                                                className={`w-full border-2 rounded-lg p-3 text-base outline-none font-medium text-gray-800 shadow-sm resize-none overflow-hidden ${isExamLocked ? 'border-gray-200 bg-gray-100/80 text-gray-700 cursor-default' : 'border-gray-300 focus:border-blue-500 bg-white'}`}
                                            ></textarea>
                                        </div>
                                    )}

                                    {question.type === 'matching' && question.pairs && (
                                        <MatchingQuestionWidget
                                            question={question}
                                            answer={answers[question.id]}
                                            onAnswerChange={(newAns) => setAnswers({ ...answers, [question.id]: newAns })}
                                            isSubmitted={isSubmitted}
                                        />
                                    )}

                                    {!isExamLocked && answers[question.id] && (
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

                                    {!isExamLocked && flagged[question.id] && (
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

                                    {isSelfMarking && !confirmingGrade && (() => {
                                        const existingDecision = manualOverrides[question.id];
                                        const decidedCount = selfMarkQueue.filter(qIdx => manualOverrides[activeExam.questions[qIdx].id] !== undefined).length;
                                        const progressPct = Math.round((decidedCount / selfMarkQueue.length) * 100);
                                        const typeLabel = question.type === 'fill_blank' ? 'Fill in the Blank' : 'Short Answer';

                                        return (
                                            <div className="mt-5 p-4 sm:p-5 rounded-xl border border-slate-200/90 bg-slate-50/75 text-sm space-y-4">
                                                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-200/70 pb-2.5">
                                                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 border border-emerald-200/80 text-emerald-800">
                                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                                        <span>Self-Mark · {typeLabel}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <span className="font-semibold text-slate-700">
                                                            Item {selfMarkPos + 1} of {selfMarkQueue.length}
                                                        </span>
                                                        <span>·</span>
                                                        <span>
                                                            {openedFromConfirm
                                                                ? 'Returns to confirmation next'
                                                                : existingDecision !== undefined
                                                                    ? `Previous: ${existingDecision ? 'Correct' : 'Wrong'}`
                                                                    : `${decidedCount} of ${selfMarkQueue.length} marked`}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-200"
                                                            style={{ width: `${progressPct}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {selfMarkQueue.map((qIdx, pos) => {
                                                            const itemQ = activeExam.questions[qIdx];
                                                            const itemDec = manualOverrides[itemQ.id];
                                                            const isCurrentItem = pos === selfMarkPos;
                                                            const pillStyle = itemDec === true
                                                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200/70'
                                                                : itemDec === false
                                                                    ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200/70'
                                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100';

                                                            return (
                                                                <button
                                                                    key={itemQ.id}
                                                                    type="button"
                                                                    onClick={() => handleJumpToSelfMarkItem(pos, false)}
                                                                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${pillStyle} ${isCurrentItem ? 'ring-2 ring-slate-700/25 border-slate-500' : ''}`}
                                                                >
                                                                    Q{qIdx + 1}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div className="bg-white p-3.5 rounded-lg border border-slate-200/80">
                                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/80">Expected Answer</div>
                                                    <div className="text-slate-800 font-medium mt-1">
                                                        <MathText text={question.correctAnswer} />
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between gap-2.5 pt-1 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={handleFlickBackSelfMark}
                                                        disabled={selfMarkPos === 0}
                                                        className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors ${selfMarkPos === 0 ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer'}`}
                                                    >
                                                        ← Previous Marked
                                                    </button>
                                                    <div className="flex items-center gap-2.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSelfMarkDecision(question.id, false)}
                                                            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${existingDecision === false ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-500/30' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'}`}
                                                        >
                                                            <span>✕</span>
                                                            <span>{existingDecision === false ? 'Keep Wrong' : 'Mark Wrong'}</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSelfMarkDecision(question.id, true)}
                                                            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${existingDecision === true ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/30' : 'bg-emerald-600/90 text-white border-emerald-600 hover:bg-emerald-700'}`}
                                                        >
                                                            <span>✓</span>
                                                            <span>{existingDecision === true ? 'Keep Correct' : 'Mark Correct'}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {isSelfMarking && confirmingGrade && (() => {
                                        const markedCorrectCount = selfMarkQueue.filter(qIdx => Boolean(manualOverrides[activeExam.questions[qIdx].id])).length;
                                        const confirmPct = selfMarkQueue.length > 0 ? Math.round((markedCorrectCount / selfMarkQueue.length) * 100) : 0;

                                        return (
                                            <div className="mt-5 p-4 sm:p-5 rounded-xl border border-slate-200/90 bg-slate-50/75 text-sm space-y-4">
                                                <div className="space-y-2 border-b border-slate-200/70 pb-2.5">
                                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 border border-sky-200/80 text-sky-800">
                                                            <span className="w-2 h-2 rounded-full bg-sky-500" />
                                                            <span>Self-Mark Confirmation</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <span className="font-semibold text-emerald-700">{markedCorrectCount} correct</span>
                                                            <span className="text-slate-300">·</span>
                                                            <span className="font-semibold text-rose-700">{selfMarkQueue.length - markedCorrectCount} wrong</span>
                                                        </div>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-rose-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-emerald-500 rounded-full transition-all duration-200"
                                                            style={{ width: `${confirmPct}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-2">
                                                    {selfMarkQueue.map((qIdx, pos) => {
                                                        const itemQ = activeExam.questions[qIdx];
                                                        const decidedRight = manualOverrides[itemQ.id];
                                                        const rawPrompt = (itemQ.question || itemQ.prompt || itemQ.text || '').replace(/\s+/g, ' ').trim();
                                                        const hintText = rawPrompt.length > 72 ? `${rawPrompt.slice(0, 72)}…` : rawPrompt;
                                                        const ansPreview = String(answers[itemQ.id] || '').replace(/\s+/g, ' ').trim();
                                                        const shortAns = ansPreview.length > 38 ? `${ansPreview.slice(0, 38)}…` : ansPreview;

                                                        return (
                                                            <button
                                                                key={itemQ.id}
                                                                type="button"
                                                                onClick={() => handleJumpToSelfMarkItem(pos, true)}
                                                                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${decidedRight ? 'border-emerald-200/80 bg-emerald-50/30 hover:bg-emerald-50/60' : 'border-rose-200/80 bg-rose-50/30 hover:bg-rose-50/60'}`}
                                                            >
                                                                <div className="min-w-0 flex-1 space-y-0.5">
                                                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                                                                        <span className={`px-1.5 py-0.5 rounded font-semibold ${decidedRight ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>Q{qIdx + 1}</span>
                                                                        {hintText && <span className="font-normal text-slate-600 truncate">{hintText}</span>}
                                                                    </div>
                                                                    {shortAns && (
                                                                        <div className="text-[11px] text-slate-400 truncate">
                                                                            Your answer: <span className="text-slate-600">{shortAns}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-md border ${decidedRight ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                                                                    {decidedRight ? '✓ Correct' : '✕ Wrong'}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                <div className="flex items-center justify-between gap-2.5 pt-1 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={handleFlickBackSelfMark}
                                                        className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                                    >
                                                        ← Back to Last Item
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleConfirmFinalGrade}
                                                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                                                    >
                                                        Confirm & Show Score
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {isSubmitted && (() => {
                                        const containerBgClass = isQuestionCorrect(question)
                                            ? "bg-emerald-50/60 border-emerald-200"
                                            : "bg-rose-50/60 border-rose-200";

                                        return (
                                            <div className={`mt-6 p-5 rounded-lg border text-sm sm:text-base space-y-4 ${containerBgClass}`}>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-700 font-bold text-sm">
                                                        Expected Answer: <MathText text={question.correctAnswer} />
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 mb-1.5">Explanation:</div>
                                                    <div className="text-gray-800 leading-relaxed">
                                                        <MathText text={question.explanation || "No detailed explanation available for this question."} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {!isSelfMarking && (
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
                            )}
                        </div>
                    </main>
                </div>
            </div>
            <FeedbackAndAdminFixesWidget currentUser={currentUser} userProfile={userProfile} isAdmin={isAdmin} activeExamTitle={activeExam?.title} />
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
