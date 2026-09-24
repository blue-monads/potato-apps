import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  Quote, 
  Minus, 
  Code, 
  Plus, 
  ChevronRight,
  Info,
  Image as ImageIcon
} from 'lucide-react';
import type { DocumentDetail, DocumentMeta } from '../types';
import { ImageModal } from './ImageModal';
import { uploadSpaceFile } from '../lib/spaceFile';

interface EditorProps {
  document: DocumentDetail;
  childDocuments: DocumentMeta[];
  onUpdateContent: (content: string) => void;
  onUpdateTitle: (title: string) => void;
  onSelectDoc: (id: number) => void;
  onAddSubpage: () => void;
  onOpenIconPicker: () => void;
}

interface SlashItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const SLASH_COMMANDS: SlashItem[] = [
  { id: 'h1', label: 'Heading 1', description: 'Large section heading', icon: <Heading1 className="h-4 w-4" /> },
  { id: 'h2', label: 'Heading 2', description: 'Medium section heading', icon: <Heading2 className="h-4 w-4" /> },
  { id: 'h3', label: 'Heading 3', description: 'Small section heading', icon: <Heading3 className="h-4 w-4" /> },
  { id: 'p', label: 'Text', description: 'Plain paragraph text', icon: <span className="font-serif font-bold text-sm">¶</span> },
  { id: 'ul', label: 'Bulleted list', description: 'Create a bulleted list', icon: <List className="h-4 w-4" /> },
  { id: 'ol', label: 'Numbered list', description: 'Create a numbered list', icon: <ListOrdered className="h-4 w-4" /> },
  { id: 'quote', label: 'Quote', description: 'Capture a quote or highlight', icon: <Quote className="h-4 w-4" /> },
  { id: 'callout', label: 'Callout box', description: 'Highlighted callout note', icon: <Info className="h-4 w-4" /> },
  { id: 'code', label: 'Code block', description: 'Code snippet with monospaced font', icon: <Code className="h-4 w-4" /> },
  { id: 'image', label: 'Image', description: 'Upload, pick from space, or embed link', icon: <ImageIcon className="h-4 w-4" /> },
  { id: 'divider', label: 'Divider', description: 'Horizontal dividing line', icon: <Minus className="h-4 w-4" /> },
];

export const Editor: React.FC<EditorProps> = ({
  document: currentDoc,
  childDocuments,
  onUpdateContent,
  onUpdateTitle,
  onSelectDoc,
  onAddSubpage,
  onOpenIconPicker,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashPosition, setSlashPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const savedSelectionRef = useRef<Range | null>(null);

  // Sync editor innerHTML when switching documents
  useEffect(() => {
    if (editorRef.current) {
      if (editorRef.current.innerHTML !== (currentDoc.content || '')) {
        editorRef.current.innerHTML = currentDoc.content || '<p></p>';
      }
    }
  }, [currentDoc.id]);

  const executeCommand = (cmd: string, val: string | null = null) => {
    document.execCommand(cmd, false, val ?? undefined);
    if (editorRef.current) {
      editorRef.current.focus();
      onUpdateContent(editorRef.current.innerHTML);
    }
  };

  const getCurrentBlock = (): HTMLElement | null => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    let node: Node | null = sel.anchorNode;
    if (node && node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }
    return (node as HTMLElement)?.closest?.('p, h1, h2, h3, blockquote, li, div.callout, pre') || null;
  };

  const closeSlashMenu = useCallback(() => {
    setSlashMenuOpen(false);
    savedSelectionRef.current = null;
  }, []);

  const openSlashMenu = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    savedSelectionRef.current = range.cloneRange();

    const rect = range.getBoundingClientRect();
    const top = Math.min(window.innerHeight - 340, Math.max(16, rect.bottom + 8));
    const left = Math.min(window.innerWidth - 280, Math.max(16, rect.left));

    setSlashPosition({ top, left });
    setSlashSelectedIndex(0);
    setSlashMenuOpen(true);
  };

  const placeCaretAtEnd = (el: HTMLElement) => {
    if (!el) return;
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
    el.focus();
  };

  const applySlashCommand = (cmdId: string) => {
    if (cmdId === 'image') {
      closeSlashMenu();
      setIsImageModalOpen(true);
      return;
    }

    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedSelectionRef.current);
    }

    const block = getCurrentBlock();
    if (block) {
      const text = block.textContent?.replace(/^\/\s*/, '') || '';
      let newBlock: HTMLElement;

      switch (cmdId) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'p':
          newBlock = document.createElement(cmdId);
          newBlock.textContent = text || '';
          block.replaceWith(newBlock);
          placeCaretAtEnd(newBlock);
          break;
        case 'ul': {
          const ul = document.createElement('ul');
          const li = document.createElement('li');
          li.textContent = text || '';
          ul.appendChild(li);
          block.replaceWith(ul);
          placeCaretAtEnd(li);
          break;
        }
        case 'ol': {
          const ol = document.createElement('ol');
          const li = document.createElement('li');
          li.textContent = text || '';
          ol.appendChild(li);
          block.replaceWith(ol);
          placeCaretAtEnd(li);
          break;
        }
        case 'quote': {
          const q = document.createElement('blockquote');
          q.textContent = text || '';
          block.replaceWith(q);
          placeCaretAtEnd(q);
          break;
        }
        case 'callout': {
          const div = document.createElement('div');
          div.className = 'callout';
          div.innerHTML = `<strong>Note</strong>${text || 'Add your callout text here.'}`;
          block.replaceWith(div);
          placeCaretAtEnd(div);
          break;
        }
        case 'code': {
          const pre = document.createElement('pre');
          const code = document.createElement('code');
          code.textContent = text || '// code snippet';
          pre.appendChild(code);
          block.replaceWith(pre);
          placeCaretAtEnd(code);
          break;
        }
        case 'divider': {
          const hr = document.createElement('hr');
          const nextP = document.createElement('p');
          nextP.innerHTML = '<br>';
          block.replaceWith(hr);
          hr.insertAdjacentElement('afterend', nextP);
          placeCaretAtEnd(nextP);
          break;
        }
      }
    }

    closeSlashMenu();
    if (editorRef.current) {
      onUpdateContent(editorRef.current.innerHTML);
    }
  };

  const openImageModalFromToolbar = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
    setIsImageModalOpen(true);
  };

  const handleInsertImage = (url: string, caption?: string) => {
    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedSelectionRef.current);
    }

    const block = getCurrentBlock();

    const figure = document.createElement('figure');
    figure.className = 'doc-image-wrap my-6 text-center select-none';
    figure.contentEditable = 'false';

    const img = document.createElement('img');
    img.src = url;
    img.alt = caption || 'Document image';
    img.className = 'max-w-full rounded-lg shadow-sm mx-auto block cursor-pointer transition-transform hover:brightness-95';

    const figcaption = document.createElement('figcaption');
    figcaption.className = 'mt-2 text-center text-xs text-[#77776f] select-text';
    figcaption.contentEditable = 'true';
    figcaption.textContent = caption || '';

    figure.appendChild(img);
    figure.appendChild(figcaption);

    const nextP = document.createElement('p');
    nextP.innerHTML = '<br>';

    if (block && editorRef.current?.contains(block)) {
      if (!block.textContent || block.textContent.trim() === '/' || block.textContent.trim() === '') {
        block.replaceWith(figure);
        figure.insertAdjacentElement('afterend', nextP);
      } else {
        block.insertAdjacentElement('afterend', figure);
        figure.insertAdjacentElement('afterend', nextP);
      }
    } else if (editorRef.current) {
      editorRef.current.appendChild(figure);
      editorRef.current.appendChild(nextP);
    }

    placeCaretAtEnd(nextP);

    if (editorRef.current) {
      onUpdateContent(editorRef.current.innerHTML);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.type.startsWith('image/')) {
      e.preventDefault();
      try {
        const spaceFile = await uploadSpaceFile(file, 'doks/images');
        if (spaceFile.url) {
          handleInsertImage(spaceFile.url, file.name.replace(/\.[^/.]+$/, ''));
        }
      } catch (err) {
        console.error('Failed to upload dropped image:', err);
      }
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          try {
            const spaceFile = await uploadSpaceFile(file, 'doks/images');
            if (spaceFile.url) {
              handleInsertImage(spaceFile.url, 'Pasted Image');
            }
          } catch (err) {
            console.error('Failed to upload pasted image:', err);
          }
        }
        break;
      }
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onUpdateContent(editorRef.current.innerHTML);

      // Check if current block text is "/"
      const block = getCurrentBlock();
      if (block && block.textContent?.trim() === '/') {
        openSlashMenu();
      } else if (slashMenuOpen) {
        closeSlashMenu();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (slashMenuOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSlashMenu();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIndex((prev) => (prev + 1) % SLASH_COMMANDS.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex((prev) => (prev - 1 + SLASH_COMMANDS.length) % SLASH_COMMANDS.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        applySlashCommand(SLASH_COMMANDS[slashSelectedIndex].id);
        return;
      }
    }

    // Markdown-like space trigger shortcuts
    if (e.key === ' ' && !e.shiftKey) {
      const block = getCurrentBlock();
      if (block) {
        const text = block.textContent || '';
        if (text === '#') {
          e.preventDefault();
          const h1 = document.createElement('h1');
          h1.innerHTML = '<br>';
          block.replaceWith(h1);
          placeCaretAtEnd(h1);
          if (editorRef.current) onUpdateContent(editorRef.current.innerHTML);
        } else if (text === '##') {
          e.preventDefault();
          const h2 = document.createElement('h2');
          h2.innerHTML = '<br>';
          block.replaceWith(h2);
          placeCaretAtEnd(h2);
          if (editorRef.current) onUpdateContent(editorRef.current.innerHTML);
        } else if (text === '###') {
          e.preventDefault();
          const h3 = document.createElement('h3');
          h3.innerHTML = '<br>';
          block.replaceWith(h3);
          placeCaretAtEnd(h3);
          if (editorRef.current) onUpdateContent(editorRef.current.innerHTML);
        } else if (text === '-' || text === '*') {
          e.preventDefault();
          const ul = document.createElement('ul');
          const li = document.createElement('li');
          li.innerHTML = '<br>';
          ul.appendChild(li);
          block.replaceWith(ul);
          placeCaretAtEnd(li);
          if (editorRef.current) onUpdateContent(editorRef.current.innerHTML);
        } else if (text === '1.') {
          e.preventDefault();
          const ol = document.createElement('ol');
          const li = document.createElement('li');
          li.innerHTML = '<br>';
          ol.appendChild(li);
          block.replaceWith(ol);
          placeCaretAtEnd(li);
          if (editorRef.current) onUpdateContent(editorRef.current.innerHTML);
        } else if (text === '>') {
          e.preventDefault();
          const bq = document.createElement('blockquote');
          bq.innerHTML = '<br>';
          block.replaceWith(bq);
          placeCaretAtEnd(bq);
          if (editorRef.current) onUpdateContent(editorRef.current.innerHTML);
        } else if (text === '---') {
          e.preventDefault();
          const hr = document.createElement('hr');
          const p = document.createElement('p');
          p.innerHTML = '<br>';
          block.replaceWith(hr);
          hr.insertAdjacentElement('afterend', p);
          placeCaretAtEnd(p);
          if (editorRef.current) onUpdateContent(editorRef.current.innerHTML);
        }
      }
    }
  };

  // Close slash menu on outside click
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (
        slashMenuRef.current &&
        !slashMenuRef.current.contains(e.target as Node) &&
        editorRef.current &&
        !editorRef.current.contains(e.target as Node)
      ) {
        closeSlashMenu();
      }
    };
    window.addEventListener('mousedown', handleDocumentClick);
    return () => window.removeEventListener('mousedown', handleDocumentClick);
  }, [closeSlashMenu]);

  return (
    <div className="relative flex-1 overflow-y-auto bg-gradient-to-b from-[#f8f8f6] to-[#f6f6f3]">
      <div className="flex justify-center px-4 py-8 pb-32 sm:px-8">
        <article className="w-full max-w-[850px] min-h-[960px] rounded-[3px] border border-[#ecece8] bg-white px-8 py-14 shadow-[0_10px_28px_rgba(30,30,25,0.07),0_1px_2px_rgba(30,30,25,0.05)] sm:px-20 sm:py-16">
          {/* Document Header (Icon + Eyebrow + Large Title) */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <button
                type="button"
                onClick={onOpenIconPicker}
                title="Change icon"
                className="group flex h-12 w-12 items-center justify-center rounded-xl text-3xl transition-transform hover:scale-110 hover:bg-[#f1f1ed]"
              >
                {currentDoc.icon || '📄'}
              </button>
              <div className="text-[11px] font-semibold tracking-wider text-[#8a8a82] uppercase">
                DOCUMENT · {currentDoc.parent_id ? 'SUBPAGE' : 'WORKSPACE'}
              </div>
            </div>

            {/* Document Title Heading */}
            <input
              type="text"
              value={currentDoc.title}
              onChange={(e) => onUpdateTitle(e.target.value)}
              placeholder="Untitled document"
              className="w-full border-0 bg-transparent font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-[#181816] outline-none placeholder:text-[#b5b5ad]"
            />
          </div>

          {/* Editable Content */}
          <div
            ref={editorRef}
            contentEditable
            spellCheck
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onPaste={handlePaste}
            className="editor-content"
          />

          {/* Subpages Section (if this document has children or user wants to add one) */}
          <div className="mt-16 border-t border-[#ecece8] pt-8">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-xs font-bold tracking-wider text-[#8a8a81] uppercase">
                Subpages ({childDocuments.length})
              </h4>
              <button
                type="button"
                onClick={onAddSubpage}
                className="flex items-center gap-1 text-xs font-medium text-[#2f6fed] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Add subpage
              </button>
            </div>

            {childDocuments.length === 0 ? (
              <p className="text-xs text-[#9a9a92] italic">
                No subpages yet. Click "Add subpage" to create child documents under this page.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {childDocuments.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => onSelectDoc(child.id)}
                    className="flex items-center gap-2.5 rounded-lg border border-[#e7e7e3] bg-[#fafaf8] p-3 text-left transition-all hover:border-[#d9d9d4] hover:bg-white hover:shadow-sm"
                  >
                    <span className="text-xl flex-shrink-0">{child.icon || '📄'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[#20201d]">
                        {child.title || 'Untitled'}
                      </p>
                      <p className="text-[10px] text-[#9a9a92]">
                        {child.updated_at ? `Updated ${new Date(child.updated_at).toLocaleDateString()}` : 'Subdocument'}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#b5b5ad] flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </article>
      </div>

      {/* Floating Slash Menu */}
      {slashMenuOpen && (
        <div
          ref={slashMenuRef}
          style={{ top: `${slashPosition.top}px`, left: `${slashPosition.left}px` }}
          className="fixed z-50 w-64 rounded-xl border border-[#dfdfda] bg-white p-1.5 shadow-[0_18px_38px_rgba(30,30,25,0.14)]"
        >
          <div className="px-2 py-1 text-[10px] font-bold tracking-wider text-[#9a9a92] uppercase">
            Basic Blocks
          </div>
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {SLASH_COMMANDS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applySlashCommand(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                  index === slashSelectedIndex ? 'bg-[#f1f1ed] text-[#20201d]' : 'text-[#67675f] hover:bg-[#f5f5f2]'
                }`}
              >
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-[#e7e7e3] bg-[#fafaf8] text-[#55554f]">
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[#20201d] leading-none mb-0.5">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-[#9a9a92] truncate leading-tight">
                    {item.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Floating Bottom Formatting Toolbar */}
      <div className="paper-toolbar select-none" aria-label="Editor toolbar">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => executeCommand('bold')}
          title="Bold"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f5f58] hover:bg-[#f1f1ed] hover:text-[#20201d]"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => executeCommand('italic')}
          title="Italic"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f5f58] hover:bg-[#f1f1ed] hover:text-[#20201d]"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => executeCommand('underline')}
          title="Underline"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f5f58] hover:bg-[#f1f1ed] hover:text-[#20201d]"
        >
          <Underline className="h-3.5 w-3.5" />
        </button>

        <div className="mx-1 h-4 w-[1px] bg-[#e7e7e3]" />

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => executeCommand('formatBlock', 'p')}
          title="Paragraph text"
          className="flex h-7 px-2 items-center justify-center rounded-md text-xs font-medium text-[#5f5f58] hover:bg-[#f1f1ed] hover:text-[#20201d]"
        >
          Text
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => executeCommand('formatBlock', 'h2')}
          title="Heading 2"
          className="flex h-7 px-2 items-center justify-center rounded-md text-xs font-semibold text-[#5f5f58] hover:bg-[#f1f1ed] hover:text-[#20201d]"
        >
          H2
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => executeCommand('formatBlock', 'h3')}
          title="Heading 3"
          className="flex h-7 px-2 items-center justify-center rounded-md text-xs font-semibold text-[#5f5f58] hover:bg-[#f1f1ed] hover:text-[#20201d]"
        >
          H3
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => executeCommand('formatBlock', 'blockquote')}
          title="Quote"
          className="flex h-7 px-2 items-center justify-center rounded-md text-xs font-medium text-[#5f5f58] hover:bg-[#f1f1ed] hover:text-[#20201d]"
        >
          Quote
        </button>

        <div className="mx-1 h-4 w-[1px] bg-[#e7e7e3]" />

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => executeCommand('insertUnorderedList')}
          title="Bulleted List"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f5f58] hover:bg-[#f1f1ed] hover:text-[#20201d]"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => executeCommand('insertOrderedList')}
          title="Numbered List"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f5f58] hover:bg-[#f1f1ed] hover:text-[#20201d]"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand('insertHorizontalRule');
          }}
          title="Divider line"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f5f58] hover:bg-[#f1f1ed] hover:text-[#20201d]"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            openImageModalFromToolbar();
          }}
          title="Insert Image"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f5f58] hover:bg-[#f1f1ed] hover:text-[#20201d]"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => executeCommand('removeFormat')}
          title="Clear formatting"
          className="flex h-7 px-2 items-center justify-center rounded-md text-[11px] font-medium text-[#8a8a81] hover:bg-[#f1f1ed] hover:text-[#20201d]"
        >
          Clear
        </button>
      </div>

      {/* Image Insertion Modal */}
      <ImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onInsert={handleInsertImage}
      />
    </div>
  );
};
