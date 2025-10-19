// ===================================================================================
// Markflow Editor Script - 2차 버그 수정 적용 (1, 2, 3, 4, 5번 등)
// ===================================================================================

// --- 전역 변수 ---
let editor;
let currentEditingBlock = null;
let footnotePopover; // 각주 팝오버를 위한 전역 변수

// --- 초기화 ---
document.addEventListener('DOMContentLoaded', () => {
    editor = document.getElementById('editor');
    editor.contentEditable = true;
    editor.innerHTML = '<div class="editor-block editing"><br></div>';
    
    currentEditingBlock = editor.querySelector('.editor-block');

    createFootnotePopover(); // 각주 팝오버 요소 생성
    setupEventListeners();
    loadTheme();
    loadSettings();
    
    // KaTeX 렌더링을 위해 window에 함수 노출 (KaTeX 로딩은 index.html에서 처리)
    window.renderKaTeX = renderKaTeX;
});

// --- KaTeX 렌더링 함수 ---
function renderKaTeX(element) {
    if (typeof katex !== 'undefined' && element) {
        try {
            // KaTeX는 인라인 수식으로 처리되도록 renderMathInElement를 사용
            // displayMode: true를 사용하면 블록 수식으로 렌더링됩니다.
            katex.render(element.textContent, element, {
                throwOnError: false,
                displayMode: true, // 블록 수식으로 렌더링
                output: 'html'
            });
        } catch (e) {
            // 오류 메시지에 백슬래시 이스케이프가 필요할 수 있으므로 escapeHtml 사용
            element.innerHTML = `<span style="color:red;">[수식 오류: ${escapeHtml(e.message)}]</span>`;
        }
    } else if (element && element.classList && element.classList.contains('latex-content')) {
        // 문서 전체에 대해 auto-render를 실행 (index.html에서 로드 시 한 번 실행됨)
        if (typeof renderMathInElement !== 'undefined') {
            renderMathInElement(document.body, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                ],
                throwOnError : false
            });
        }
    }
}

// --- 각주 팝오버 생성 ---
function createFootnotePopover() {
    footnotePopover = document.createElement('div');
    footnotePopover.className = 'footnote-popover';
    document.body.appendChild(footnotePopover);
}

// --- 이벤트 리스너 설정 ---
function setupEventListeners() {
    editor.addEventListener('input', handleInput);
    editor.addEventListener('click', handleClick);
    editor.addEventListener('keydown', handleKeyDown);
    editor.addEventListener('paste', handlePaste); 
    
    // 에디터 밖 클릭 시 전체 렌더링 (blur 이벤트)
    editor.addEventListener('blur', (e) => {
        setTimeout(() => {
            if (!editor.contains(document.activeElement)) {
                if (currentEditingBlock) {
                    currentEditingBlock.setAttribute('data-raw', currentEditingBlock.textContent || '');
                    currentEditingBlock.classList.remove('editing'); 
                }
                renderDocument();
            }
        }, 100);
    });

    // 각주 호버 이벤트 (이벤트 위임)
    editor.addEventListener('mouseover', (e) => {
        const target = e.target;
        if (target.classList.contains('footnote')) {
            footnotePopover.innerHTML = target.getAttribute('data-content'); 
            const rect = target.getBoundingClientRect();
            
            footnotePopover.style.opacity = '0'; 
            footnotePopover.style.display = 'block'; 
            const popoverWidth = footnotePopover.offsetWidth;
            const popoverHeight = footnotePopover.offsetHeight;
            
            let top = rect.top - popoverHeight - 10;
            let left = rect.right - popoverWidth;

            if (top < 10) top = rect.bottom + 10;
            if (left < 10) left = 10;
            if (left + popoverWidth > window.innerWidth - 10) {
                left = window.innerWidth - popoverWidth - 10;
            }

            footnotePopover.style.left = `${left}px`;
            footnotePopover.style.top = `${top}px`;
            footnotePopover.style.opacity = '1'; 
        }
        
        // 링크 미리보기 호버 로직
        if (target.tagName === 'A' && target.nextElementSibling && target.nextElementSibling.classList.contains('link-preview')) {
            target.nextElementSibling.classList.add('show-preview');
        }
    });

    editor.addEventListener('mouseout', (e) => {
        if (e.target.classList.contains('footnote')) {
            footnotePopover.style.opacity = '0';
            setTimeout(() => {
                footnotePopover.style.display = 'none'; 
            }, 200); 
        }
        
        // 링크 미리보기 호버 로직
        if (e.target.tagName === 'A' && e.target.nextElementSibling && e.target.nextElementSibling.classList.contains('link-preview')) {
            e.target.nextElementSibling.classList.remove('show-preview');
        }
    });

    // --- 버튼 이벤트 ---
    document.getElementById('newBtn').addEventListener('click', newDocument);
    document.getElementById('saveBtn').addEventListener('click', saveDocument);
    document.getElementById('loadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('closeSettings').addEventListener('click', closeSettings);
    document.getElementById('fileInput').addEventListener('change', loadDocument);
    document.getElementById('fontSize').addEventListener('change', applySettings);
    document.getElementById('fontFamily').addEventListener('change', applySettings);
    document.getElementById('settingsModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('settingsModal')) {
            closeSettings();
        }
    });
}

// --- 핸들러 함수들 ---
function handleInput(e) {
    const block = getContainingBlock(window.getSelection().anchorNode);
    if (block) {
        block.classList.add('editing');
        currentEditingBlock = block;

        // 빈 블록 상태 유지 (<br> 태그)
        if (block.textContent === '' && block.childNodes.length === 0) {
            block.innerHTML = '<br>';
            setTimeout(() => {
                const sel = window.getSelection();
                const range = document.createRange();
                range.setStart(block, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }, 0);
        }
    }
}

function handleClick(e) {
    const block = getContainingBlock(e.target);
    
    // 9. 목차 링크 클릭 시 수정 모드 돌입 방지
    if (e.target.tagName === 'A' && block.querySelector('.toc-container')) {
        e.stopPropagation();
        return;
    }

    if (block && !block.classList.contains('editing')) {
        switchToEditMode(block);
    }
}

function handleKeyDown(e) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const currentBlock = getContainingBlock(range.startContainer);

    if (e.key === 'Enter') {
        e.preventDefault();
        if (!currentBlock) return;

        // 커서 위치 계산
        let cursorPos = 0;
        if (range.startContainer.nodeType === Node.TEXT_NODE) {
            cursorPos = range.startOffset;
        } else {
            // 엘리먼트 노드인 경우, startOffset은 자식 노드 인덱스
            if (range.startOffset === currentBlock.childNodes.length) {
                cursorPos = currentBlock.textContent.length;
            } else {
                cursorPos = 0;
            }
        }

        // 블록의 전체 텍스트
        const fullText = currentBlock.textContent;
        const beforeText = fullText.substring(0, cursorPos);
        const afterText = fullText.substring(cursorPos);

        // 현재 블록 업데이트
        currentBlock.textContent = beforeText;
        currentBlock.setAttribute('data-raw', beforeText);
        if (beforeText === '') {
            currentBlock.innerHTML = '<br>';
        }

        // 새 블록 생성
        const newBlock = document.createElement('div');
        newBlock.className = 'editor-block editing';
        newBlock.setAttribute('data-raw', afterText);
        newBlock.textContent = afterText;
        if (afterText === '') {
            newBlock.innerHTML = '<br>';
        }

        // DOM에 삽입
        currentBlock.parentNode.insertBefore(newBlock, currentBlock.nextSibling);
        currentEditingBlock = newBlock;

        // 커서를 새 블록 맨 앞으로 설정
        setTimeout(() => {
            newBlock.focus();
            const sel = window.getSelection();
            const newRange = document.createRange();
            
            const firstChild = newBlock.firstChild;
            if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
                newRange.setStart(firstChild, 0);
            } else {
                newRange.setStart(newBlock, 0);
            }
            
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
        }, 0);

    } else if (e.key === 'Backspace') {
        if (!currentBlock) return;

        // 첫 번째 블록이면서 비어있거나 커서가 맨 앞인 경우
        if (!currentBlock.previousSibling && range.startOffset === 0) {
            e.preventDefault();
            return;
        }

        // 현재 블록이 비어있고 이전 블록이 있는 경우, 이전 블록과 병합
        if (range.startOffset === 0 && currentBlock.previousSibling) {
            e.preventDefault();

            const prevBlock = currentBlock.previousSibling;
            const prevText = prevBlock.getAttribute('data-raw') || prevBlock.textContent || '';
            const currentText = currentBlock.getAttribute('data-raw') || currentBlock.textContent || '';

            // 이전 블록에 현재 텍스트 추가
            const mergedText = prevText + currentText;
            prevBlock.setAttribute('data-raw', mergedText);
            prevBlock.textContent = mergedText;
            prevBlock.classList.add('editing');
            prevBlock.style.display = '';

            // 현재 블록 제거
            currentBlock.remove();
            currentEditingBlock = prevBlock;

            // 커서를 병합 지점에 설정
            setTimeout(() => {
                prevBlock.focus();
                const sel = window.getSelection();
                const newRange = document.createRange();
                
                const firstChild = prevBlock.firstChild;
                if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
                    newRange.setStart(firstChild, prevText.length);
                } else {
                    newRange.setStart(prevBlock, 0);
                }
                
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
            }, 0);

            renderDocument();
        }

    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        setTimeout(() => {
            const newBlock = getContainingBlock(window.getSelection().anchorNode);
            if (newBlock && newBlock !== currentEditingBlock) {
                switchToEditMode(newBlock);
            }
        }, 10);
    }
}

// 붙여넣기 로직 (변경 없음)
function handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    const lines = text.split('\n');
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const currentBlock = getContainingBlock(selection.anchorNode);
    if (!currentBlock) return;

    const range = selection.getRangeAt(0);

    // 커서 이전/이후 텍스트 분리 (paste에서도 동일한 안전 로직 사용)
    const tempRangeBefore = range.cloneRange();
    tempRangeBefore.setStart(currentBlock, 0);
    tempRangeBefore.setEnd(range.startContainer, range.startOffset);
    const beforeCursor = tempRangeBefore.toString();
    
    const tempRangeAfter = range.cloneRange();
    tempRangeAfter.setStart(range.endContainer, range.endOffset);
    tempRangeAfter.setEnd(currentBlock, currentBlock.childNodes.length);
    const afterCursor = tempRangeAfter.toString();

    // 현재 블록에 첫 줄 붙여넣기
    currentBlock.textContent = beforeCursor + lines[0];
    
    let lastBlock = currentBlock;

    // 새 블록에 나머지 줄 붙여넣기
    for (let i = 1; i < lines.length; i++) {
        const newBlock = document.createElement('div');
        newBlock.className = 'editor-block';
        newBlock.setAttribute('data-raw', lines[i]);  // <- 이 줄 추가
        newBlock.textContent = lines[i];
        currentBlock.parentNode.insertBefore(newBlock, lastBlock.nextSibling);
        lastBlock = newBlock;
    }
    
    // 마지막 블록에 커서 이후 텍스트 붙여넣기
    lastBlock.textContent += afterCursor;

    currentBlock.setAttribute('data-raw', currentBlock.textContent || '');
    lastBlock.setAttribute('data-raw', lastBlock.textContent || '');

    renderDocument(); 

    // 커서 위치 재설정
    const finalOffset = lastBlock.textContent.length - afterCursor.length;
    switchToEditMode(lastBlock, finalOffset); 
}


// --- 핵심 로직 함수들 ---
function getContainingBlock(node) {
    while (node && node !== editor) {
        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('editor-block')) {
            return node;
        }
        node = node.parentNode;
    }
    return null;
}

function switchToEditMode(block, cursorPos = 'end') {
    if (!block) return;
    
    if (currentEditingBlock && currentEditingBlock !== block) {
        currentEditingBlock.setAttribute('data-raw', currentEditingBlock.textContent || '');
        currentEditingBlock.classList.remove('editing'); 
        renderDocument(); 
    }
    
    block.classList.add('editing');
    block.classList.remove('rendered', 'heading-block', 'code-block-marker', 'code-block-content', 'code-block-start', 'code-block-end', 'rendered-latex'); 
    block.style.display = '';

    const rawText = block.getAttribute('data-raw') || '';
    block.textContent = rawText;
    
    if (rawText === '') {
        block.innerHTML = '<br>';
    }

    currentEditingBlock = block;
    block.focus();
    
    setTimeout(() => {
        const sel = window.getSelection();
        const range = document.createRange();
        
        if (block.childNodes.length === 0) {
            range.setStart(block, 0);
        } else {
            const textNode = block.firstChild;
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                if (cursorPos === 'end') {
                    range.setStart(textNode, textNode.length);
                } else if (cursorPos === 'start') {
                    range.setStart(textNode, 0);
                } else if (typeof cursorPos === 'number') {
                    range.setStart(textNode, Math.min(cursorPos, textNode.length));
                }
            } else {
                range.setStart(block, 0);
            }
        }
        
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }, 0);
}

// 문서 전체 렌더링
function renderDocument() {
    const blocks = Array.from(editor.querySelectorAll('.editor-block'));
    
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeStartIndex = -1;
    let inQuoteBlock = false;
    let inList = false;
    let listType = null;
    let listContainer = null;
    
    // 1. 블록 순회 및 렌더링
    blocks.forEach((block, index) => {
        if (block.classList.contains('editing')) {
            inCodeBlock = false;
            inQuoteBlock = false;
            inList = false;
            return;
        }

        const rawText = block.getAttribute('data-raw') || block.textContent || '';
        block.setAttribute('data-raw', rawText);
        
        // 클래스와 스타일 초기화
        block.className = 'editor-block';
        block.style.display = '';
        block.innerHTML = '';

        const trimmed = rawText.trim();
        
        // --- 코드 블록 종료 ---
        const isCodeBlockEndMarker = (trimmed === '```');
        if (inCodeBlock) {
            if (isCodeBlockEndMarker) {
                inCodeBlock = false;
                block.classList.add('code-block-marker');
                block.innerHTML = '```';
                return;
            } else {
                block.classList.add('code-block-content', 'rendered');
                if (index === codeStartIndex + 1) {
                    block.classList.add('code-block-start');
                }
                block.textContent = rawText; // 원본 텍스트 유지
                return;
            }
        }


        // --- 인용문 블록 종료 ('"""') ---
        if (inQuoteBlock && trimmed === '"""') {
            inQuoteBlock = false;
            block.style.display = 'none';
            return;
        }

        // --- 인용문 블록 내부 ---
        if (inQuoteBlock) {
            block.classList.add('blockquote-content');
            block.innerHTML = parseInlineMarkdown(rawText);
            block.classList.add('rendered');
            return;
        }


        // --- TOC (목차) ---
        if (trimmed.match(/^\$\$TOC\$\$\s*>\s*"(.*?)"$/) || trimmed === '$$TOC$$') {
            block.innerHTML = '<div class="toc-container"></div>';
            block.classList.add('rendered');
            inList = false;
            inQuoteBlock = false;
            return;
        }

        // --- 코드 블록 시작 ---
        const codeStartMatch = trimmed.match(/^\$\$SCRIPT\$\s*>\s*"(.*?)"\s*>\s*```$/);
        if (codeStartMatch) {
            inCodeBlock = true;
            codeLanguage = codeStartMatch[1];
            codeStartIndex = index;
            block.classList.add('code-block-marker');
            block.innerHTML = `<span class="code-language">!(${escapeHtml(codeLanguage)})</span>`;
            inList = false;
            inQuoteBlock = false;
            return;
        }

        // --- 인용문 블록 시작 ('"""') ---
        if (trimmed === '"""' && !inQuoteBlock) {
            inQuoteBlock = true;
            block.innerHTML = `<div class="blockquote-marker">"""</div>`;
            block.classList.add('rendered');
            return;
        }

        // --- 수평선 ---
        if (trimmed === '----') {
            block.innerHTML = '<hr class="horizontal-rule">';
            block.classList.add('rendered');
            inList = false;
            inQuoteBlock = false;
            return;
        }

        // --- 헤딩 (오류 4 수정: 숫자 없는 개요에 자동 카운팅 제거) ---
        const headingMatch = trimmed.match(/^(#{1,6})\s*(.*)$/);
        if (headingMatch) {
            const levelMark = headingMatch[1];
            let fullContent = headingMatch[2];
            const level = levelMark.length;
            let levelString = '';
            let displayContent = '';
            
            // 숫자 개요 문법 확인: 텍스트가 "1. ", "1.1. " 등으로 시작하는지, 또는 "1 " 등으로 시작하는지 확인
            const numMatch = fullContent.match(/^(\d+\.(?:\d+\.)*|\d+)\s+(.*)$/); 

            if (numMatch) {
                // 숫자 있는 개요 문법 (예: #1, ## 1.1)
                const explicitNumber = numMatch[1];
                displayContent = numMatch[2];
                
                // levelString 설정: 1.1.1 -> 1.1.1. (또는 1 -> 1.)
                levelString = explicitNumber.endsWith('.') ? explicitNumber : explicitNumber + '.';

            } else {
                // 숫자 없는 개요 문법 (예: # 개요 1단계)
                levelString = '';
                displayContent = fullContent;
            }

            // data-level-string에 번호를 저장하여 TOC에서 사용 (오류 3 수정 대비)
            block.innerHTML = `<h${level} class="rendered-heading" data-level-string="${escapeHtml(levelString)}">${escapeHtml(levelString)} ${parseInlineMarkdown(displayContent)}</h${level}>`;
            block.classList.add('rendered', 'heading-block');
            inList = false;
            inQuoteBlock = false;
            return;
        }
        
        // --- 리스트 (오류 2 수정: *와 리스트 이어가기) ---
        // - 점 리스트, + 숫자 리스트
        const listMatch = trimmed.match(/^([*+-])\s+(.+)$/); // *, -, + 모두 처리
        if (listMatch) {
            const symbol = listMatch[1];
            // * 또는 -는 점 리스트, +는 숫자 리스트
            const newListType = (symbol === '+') ? 'ol' : 'ul';
            const content = listMatch[2];
            const listClass = newListType === 'ol' ? 'num' : 'dot';

            let listContainerFound = false;

            if (inList && listType === newListType && listContainer) {
                listContainerFound = true;
            }

            if (!listContainerFound) {
                // 새 리스트 시작
                inList = true;
                listType = newListType;
                listContainer = document.createElement(newListType);
                
                block.innerHTML = '';
                block.appendChild(listContainer);
                block.classList.add('rendered');
                block.style.display = '';
            } else {
                // 기존 리스트 계속 (현재 블록 숨김)
                block.innerHTML = '';
                block.style.display = 'none'; 
            }

            if (listContainer) {
                const listItem = document.createElement('li');
                listItem.className = `list-item ${listClass}`;
                listItem.innerHTML = parseInlineMarkdown(content);
                listContainer.appendChild(listItem);
            }
            
            inQuoteBlock = false;
            return;
        }


        // --- 일반 블록 ---
        if (inList) {
            inList = false;
            listType = null;
            listContainer = null;
        }
        inQuoteBlock = false;

        if (trimmed === '') {
            block.innerHTML = '<br>';
        } else {
            block.innerHTML = parseInlineMarkdown(rawText);
        }
        block.classList.add('rendered');
    });

    // 2. 코드 블록의 시작/종료 표시 (렌더링 후 재처리)
    let tempInCodeBlock = false;
    blocks.forEach((block, index) => {
        const rawText = block.getAttribute('data-raw') || block.textContent || '';
        const trimmed = rawText.trim();

        if (trimmed.match(/^\$\$SCRIPT\$\s*>\s*"(.*?)"\s*>\s*```$/)) {
            tempInCodeBlock = true;
            block.classList.add('code-block-start');
        } else if (tempInCodeBlock && index > 0 && blocks[index-1].classList.contains('code-block-content') && trimmed === '```') {
                // 이전 블록이 콘텐츠 블록이고 현재가 종료 마커일 때
                blocks[index-1].classList.add('code-block-end');
                tempInCodeBlock = false;
        } else if (block.classList.contains('code-block-content')) {
            // 인접한 콘텐츠 블록이 아닐 경우 (중간에 코드가 끊겼을 경우)
            if (index > 0 && !blocks[index - 1].classList.contains('code-block-content') && !blocks[index - 1].classList.contains('code-block-marker')) {
                // 첫 번째 블록일 가능성 (비정상 종료 시)
                block.classList.add('code-block-start');
            }
        } else {
            tempInCodeBlock = false;
        }
    });


    updateTOC(); // 오류 3 수정은 updateTOC 함수 자체에 반영됨

    if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(editor, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false}
            ],
            throwOnError: false
        });
    }
}


// ===== 문제 5: renderBlock 함수 단순화 =====
function renderBlock(block, rawText) {
    const trimmed = rawText.trim();

    if (trimmed === '') {
        block.innerHTML = '<br>';
        return;
    }

    block.innerHTML = parseInlineMarkdown(rawText);
    block.classList.add('rendered');
    setupHoverStrikethroughForBlock(block);
}

// 목차 생성 및 업데이트
function updateTOC() {
    // $$TOC$$ 블록 찾기
    const tocBlock = Array.from(editor.querySelectorAll('.editor-block')).find(b => {
        const raw = b.getAttribute('data-raw')?.trim();
        // $$TOC$$또는$$TOC$$ > "목차 제목" 모두 허용
        return raw === '$$TOC$$' || raw?.match(/^\$\$TOC\$\$\s*>\s*"(.*?)"$/);
    });
    const headingBlocks = Array.from(editor.querySelectorAll('.rendered-heading'));

    if (!tocBlock) return;

    const tocContainer = tocBlock.querySelector('.toc-container');
    if (!tocContainer) return;

    // 목차 제목 추출 (기본값: "목차")
    const tocTitleMatch = tocBlock.getAttribute('data-raw')?.trim().match(/^\$\$TOC\$\$\s*>\s*"(.*?)"$/);
    const tocTitle = tocTitleMatch ? tocTitleMatch[1] : '목차';

    if (headingBlocks.length === 0) {
        tocContainer.innerHTML = `<h2>${escapeHtml(tocTitle)}</h2><p style="padding-left:10px;">문서에 제목이 없습니다</p>`;
        return;
    }

    let tocHtml = `<h2>${escapeHtml(tocTitle)}</h2><ul>`;
    headingBlocks.forEach((h, index) => {
        const id = `heading-${index}`;
        h.id = id;
        const level = parseInt(h.tagName.substring(1));
        
        let levelString = h.getAttribute('data-level-string') || '';
        
        // 오류 3 수정: h.textContent에서 levelString을 제거하고 정확한 텍스트 추출
        let headingText = h.textContent.startsWith(levelString) 
                            ? h.textContent.substring(levelString.length).trim() 
                            : h.textContent.trim(); 
        
        // levelString이 비어있지 않다면, 텍스트에 공백을 추가하여 합칩니다.
        const tocLinkText = levelString ? `${levelString} ${headingText}` : headingText;

        tocHtml += `<li class="toc-level-${level}"><a href="#${id}">${tocLinkText}</a></li>`;
    });
    tocHtml += '</ul>';
    
    tocContainer.innerHTML = tocHtml;
    
    // 목차 링크 클릭 이벤트 (부드러운 스크롤)
    tocContainer.removeEventListener('click', tocLinkClickHandler);
    tocContainer.addEventListener('click', tocLinkClickHandler);

    // 새 함수 추가 (전역 함수로)
    function tocLinkClickHandler(e) {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            e.stopPropagation();
            const targetId = e.target.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }
}

// --- 인라인 마크다운 파싱 및 유틸리티 ---
function parseInlineMarkdown(text) {
    if (!text) return '';

    // 1. 서식 제거 구간 처리 ({{{...}}})
    let escapeMap = {};
    let escapeCounter = 0;
    text = text.replace(/\{\{\{(.*?)\}\}\}/gs, (match, p1) => {
        const key = `@@@ESCAPE_${escapeCounter}@@@`; // 더 독특한 마커 사용 (오류 1 수정)
        escapeMap[key] = escapeHtml(p1);
        escapeCounter++;
        return key;
    });
    
    // 2. 백슬래시 이스케이프 임시 처리
    let bsMap = {};
    let bsCounter = 0;
    text = text.replace(/\\([\*\/\-~\_\^,\$\{\[:\#\>"|\]])/g, (match, p1) => { 
        const key = `@@@BS_${bsCounter}@@@`;
        bsMap[key] = p1;
        bsCounter++;
        return key;
    });
    
    // 3. HTML 이스케이프 (전체 텍스트 이스케이프)
    text = escapeHtml(text);

    // 4. 링크 (문법: [[링크 텍스트|웹사이트 하이퍼 링크]])
    text = text.replace(/\[\[(.+?)\|(.+?)\]\]/g, (match, linkText, url) => {
        return `<a href="${url.trim()}" target="_blank" rel="noopener noreferrer">${linkText.trim()}</a><span class="link-preview">(${url.trim()})</span>`;
    });
    
    // 5. 각주 (기존 인라인 각주 문법 유지: :::각주 내용(각주 제목):::)
    // 오류 2 수정: 각주 파싱 로직 재추가
    text = text.replace(/:::(.+?)\((.+?)\):::/g, (match, content, title) => {
        const safeTitle = title.trim();
        const safeContent = content.trim();
        // data-content 속성값을 HTML 엔티티로 인코딩
        const encodedContent = safeContent
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return `<span class="footnote" data-title="${safeTitle}" data-content="${encodedContent}">${safeTitle}</span>`;
    });

    
    // 6. 인라인 서식 (순서 중요)
    text = text.replace(/~~(.+?)~~/g, '<span class="hover-strikethrough">$1</span>'); // 호버 취소선
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); // 볼드
    text = text.replace(/\/\/(.+?)\/\//g, '<em>$1</em>'); // 이탤릭
    text = text.replace(/__(.+?)__/g, '<u>$1</u>'); // 언더바
    text = text.replace(/--(.+?)--/g, '<del>$1</del>'); // 취소선
    text = text.replace(/\^\^(.+?)\^\^/g, '<sup>$1</sup>'); // 윗첨자
    text = text.replace(/,,(.+?),,/g, '<sub>$1</sub>'); // 아랫첨자

    // 7. 백슬래시 이스케이프 복구
    Object.keys(bsMap).forEach(key => {
        text = text.split(key).join(bsMap[key]);
    });
    
    // 8. 서식 제거 구간 복구 (오류 1 수정: 고유 마커를 사용하여 정확히 복구)
    Object.keys(escapeMap).forEach(key => {
        // 정규식 대신 .split().join()을 사용 (더 빠르고 Markflow 구조에 맞음)
        text = text.split(key).join(escapeMap[key]);
    });

    return text;
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function setupHoverStrikethroughForBlock(block) {
    if (!block) return;
    
    block.querySelectorAll('.hover-strikethrough').forEach(el => {
        el.addEventListener('mouseenter', () => el.classList.add('active'));
        el.addEventListener('mouseleave', () => el.classList.remove('active'));
        el.addEventListener('touchstart', (e) => { 
            e.preventDefault(); 
            el.classList.toggle('active'); 
        });
    });
}


function getEditorText() {
    return Array.from(editor.querySelectorAll('.editor-block'))
        .filter(block => block.style.display !== 'none')
        .map(block => {
            if (block.classList.contains('editing')) {
                return block.textContent || '';
            }
            return block.getAttribute('data-raw') || '';
        })
        .join('\n');
}

function setEditorText(text) {
    editor.innerHTML = '';
    const lines = text.split('\n');
    
    lines.forEach(line => {
        const block = document.createElement('div');
        block.className = 'editor-block';
        block.setAttribute('data-raw', line);
        block.textContent = line;
        editor.appendChild(block);
    });
    
    if (lines.length === 0) {
        editor.innerHTML = '<div class="editor-block editing"><br></div>';
        currentEditingBlock = editor.querySelector('.editor-block');
    } else {
        currentEditingBlock = null;
        renderDocument();
        const lastBlock = editor.querySelector('.editor-block:last-child');
        if (lastBlock) {
            switchToEditMode(lastBlock, 'end');
        }
    }
}

function newDocument() {
    if (getEditorText().trim() && !confirm('현재 문서를 지우고 새 문서를 만드시겠습니까?')) {
        return;
    }
    editor.innerHTML = '<div class="editor-block editing"><br></div>';
    currentEditingBlock = editor.querySelector('.editor-block');
}

function saveDocument() {
    if (currentEditingBlock) {
        currentEditingBlock.setAttribute('data-raw', currentEditingBlock.textContent || '');
    }
    renderDocument();
    
    const content = getEditorText();
    
    // 파일명 추출
    const firstHeading = content.split('\n')
        .find(line => line.trim().match(/^(#+)\s*(.+)$/));
    
    let fileName = 'document.mdp';
    if (firstHeading) {
        const titleMatch = firstHeading.trim().match(/^(#+)\s*(.+)$/);
        if (titleMatch && titleMatch[2]) {
            fileName = titleMatch[2].trim().replace(/[<>:"/\\|?*]/g, '_') + '.mdp';
        }
    }

    if (!fileName || fileName === '.mdp') {
        fileName = 'document.mdp';
    }

    try {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        // 메모리 정리
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    } catch (error) {
        console.error('파일 저장 오류:', error);
        alert('파일 저장에 실패했습니다.');
    }
}


function loadDocument(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            setEditorText(event.target.result);
        } catch (error) {
            console.error('파일 로드 오류:', error);
            alert('파일을 불러올 수 없습니다.');
        }
    };
    reader.onerror = () => {
        alert('파일 읽기에 실패했습니다.');
    };
    reader.readAsText(file);
    e.target.value = '';
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
}

function loadTheme() {
    document.documentElement.setAttribute('data-theme', 'light');
}

function openSettings() {
    document.getElementById('settingsModal').classList.add('show');
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('show');
}

function applySettings() {
    const fontSize = document.getElementById('fontSize').value;
    const fontFamily = document.getElementById('fontFamily').value;
    editor.style.fontSize = fontSize + 'px';
    editor.style.fontFamily = fontFamily;
}

function loadSettings() {
    const fontSize = '16';
    const fontFamily = '"Noto Sans CJK KR", sans-serif';
    
    document.getElementById('fontSize').value = fontSize;
    document.getElementById('fontFamily').value = fontFamily;
    
    applySettings();
}