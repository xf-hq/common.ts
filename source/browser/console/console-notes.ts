import { MaterialSC } from '../../color/material';
import { Lazy } from '../../general/factories-and-latebinding';
import { makeCache } from '../../general/ids-and-caching';
import { isArray, isString } from '../../general/type-checking';
import { inls } from '../../primitive';
import { ConsoleMessage, isConsoleMessage } from './console-message';

const PLAIN_MESSAGE_COLOR = MaterialSC.orange[300].desaturate('75%');
const PLAIN_MESSAGE_STYLE = {
  'color': PLAIN_MESSAGE_COLOR,
  'font-weight': 'normal',
};
const PRECOLLAPSED_MESSAGE_STYLE = {
  'color': '#977069',
  'font-weight': 'normal',
};

export namespace ConsoleNotes {
  export type ContentItem = string | ConsoleMessage;
  export type ContentList = ContentItemOrList[];
  export type ContentItemOrList = ContentItem | ContentList;

  export const doesArrayContainOnlyNotesContent = makeCache((x: any[]) => {
    for (let i = 0; i < x.length; i++) {
      if (!isContentItemOrList(x[i])) return false;
    }
    return true;
  });
  export const isContentItem = (x: any): x is ContentItem => isString(x) || isConsoleMessage(x);
  export const isContentList = (x: any): x is ContentList => isArray(x) && doesArrayContainOnlyNotesContent(x);
  export const isContentItemOrList = (x: any): x is ContentItemOrList => isContentItem(x) || isContentList(x);

  export function appendToExistingMessage (parent: ConsoleMessage, notesContent: ContentItemOrList) {
    if (isContentItem(notesContent)) {
      parent.appendToGroup(FormatMessage.item(notesContent));
    }
    else if (isContentList(notesContent)) {
      const messages = createMessageList(notesContent);
      parent.appendToGroup(...messages);
    }
  }

  export function printStandaloneMessage (notesContent: ContentItem): void {
    createStandaloneMessage(notesContent).print();
  }

  export function printMessageList (notesContent: ContentList): void {
    for (const msg of createMessageList(notesContent)) {
      msg.print();
    }
  }

  export function createStandaloneMessage (notesContent: ContentItem): ConsoleMessage {
    return FormatMessage.item(notesContent);
  }

  export function createMessageList (notesContent: ContentList): ConsoleMessage[] {
    let previousMessage!: ConsoleMessage;
    const messages: ConsoleMessage[] = [];
    for (let i = 0; i < notesContent.length; i++) {
      const item = notesContent[i];
      if (isContentItem(item)) {
        previousMessage = FormatMessage.item(item);
        messages.push(previousMessage);
      }
      else if (isContentList(item)) {
        if (i === 0) messages.push(...createMessageList(item));
        else {
          const childMessages = createMessageList(item);
          if (childMessages.length > 0) {
            previousMessage.appendToGroup(...childMessages);
          }
        }
      }
    }
    return messages;
  }

  namespace FormatMessage {
    type Formatter = (text: string, next?: Formatter) => ContentItemOrList;
    const formatNext = (text: string, formatters: Formatter[], nextIndex: number) => {
      if (nextIndex < formatters.length) return formatters[nextIndex](text, (text) => formatNext(text, formatters, nextIndex + 1));
      return text;
    };

    const FORMATTERS: Formatter[] = [
      markAsDone,
      markAsDeprecated,
      alert,
      emphasize,
      deemphasize,
      bulleted,
      boldWords,
      italicWords,
    ];

    export function item (message: ContentItemOrList): ConsoleMessage {
      return format(message, FORMATTERS, PLAIN_MESSAGE_STYLE);
    }

    function format (text: ContentItemOrList, formatters: Formatter[], defaultStyle?: Record<string, any>): ConsoleMessage {
      let message: ConsoleMessage;
      if (isString(text)) {
        text = inls(text);
        let collapse = false;
        if (text.length > 0) {
          if (text.startsWith('--')) {
            collapse = true;
            text = text.slice(2);
          }
          else if (rxMarkedAsDone.test(text)) {
            collapse = true;
          }
        }
        message = ConsoleMessage(formatNext(text, formatters, 0), collapse ? PRECOLLAPSED_MESSAGE_STYLE : defaultStyle);
        if (collapse) message.collapseGroup();
      }
      else if (isArray(text)) {
        message = ConsoleMessage(text, defaultStyle);
      }
      else {
        message = text;
      }
      return message;
    }


    const rxMarkedAsDone = /^\/(?!\/)(- +)? */;
    const COLOR_DONE_ICON = MaterialSC.lime[500];
    const COLOR_DONE_TEXT = COLOR_DONE_ICON.darken('50%');
    const MARKED_AS_DONE_PREFIX = Lazy(() => ConsoleMessage('\u2714', { 'color': COLOR_DONE_ICON }).spaceRight());

    function markAsDone (text: string, next?: (text: string) => ContentItemOrList): ContentItemOrList {
      const prefixLength = text.match(rxMarkedAsDone)?.[0].length ?? 0;
      text = text.slice(prefixLength);
      const innerMessage = next?.(text) ?? text;
      if (prefixLength === 0) return innerMessage;
      return ConsoleMessage([MARKED_AS_DONE_PREFIX.value, ConsoleMessage(innerMessage, { 'text-decoration': 'line-through' })], { 'color': COLOR_DONE_TEXT });
    }

    const rxDeprecated = /^X(?!X)(- +)? */;
    const COLOR_DEPRECATED = MaterialSC.brown[700].desaturate('60%');
    const CIRCLE_CROSS = Lazy(() => ConsoleMessage('\u26d2', { 'color': COLOR_DEPRECATED }).spaceRight()); // ⛒

    function markAsDeprecated (text: string, next?: (text: string) => ContentItemOrList): ContentItemOrList {
      const prefixLength = text.match(rxDeprecated)?.[0].length ?? 0;
      text = text.slice(prefixLength);
      const innerMessage = next?.(text) ?? text;
      if (prefixLength === 0) return innerMessage;
      return ConsoleMessage([CIRCLE_CROSS.value, ConsoleMessage(innerMessage, { 'text-decoration': 'line-through' })], { 'color': COLOR_DEPRECATED });
    }

    const RED_DOT = Lazy(() => ConsoleMessage('\u{1F534}').spaceRight()); // 🔴

    function alert (text: string, next?: (text: string) => ContentItemOrList): ContentItemOrList {
      const numPrefixChars = text.match(/^!*/)![0].length;
      text = text.slice(numPrefixChars);
    if (numPrefixChars === 2 && text.startsWith('- ')) text = text.slice(2);
      const message: ContentItemOrList = next?.(text) ?? text;
      switch (numPrefixChars) {
        case 0: return message;
        case 1: return ConsoleMessage(message, {
          'color': MaterialSC.yellow,
          'font-weight': 'bold',
        });
        case 2: return ConsoleMessage([RED_DOT.value, message], {
          'margin-left': '-4px',
          'padding': '5px 4px 4px 0',
          'color': MaterialSC.amber,
          'font-size': '18px',
          'font-weight': 'bold',
        });
        default: return ConsoleMessage(message, {
          'color': MaterialSC.red,
          'font-weight': 'bold',
        });
      }
    }

    function emphasize (text: string, next?: (text: string) => ContentItemOrList): ContentItemOrList {
      const numPrefixChars = text.match(/^(?:\*(?!\*))?/)![0].length;
      text = text.slice(numPrefixChars);
      const message: ContentItemOrList = next?.(text) ?? text;
      switch (numPrefixChars) {
        case 0: return message;
        case 1: return ConsoleMessage(message, {
          'color': PLAIN_MESSAGE_COLOR.multiplyHSL(1, 3, 1),
          'font-weight': 'bold',
        });
        default: return ConsoleMessage(message, {
          'color': 'white',
          'font-weight': 'bold',
        });
      }
    }

    const COLOR_DEEMPHASIS_1 = PLAIN_MESSAGE_COLOR.multiplyHSL(1, 0.5, 0.75);
    const COLOR_DEEMPHASIS_2 = PLAIN_MESSAGE_COLOR.multiplyHSL(1, 0.5, 0.5);
    const COLOR_DEEMPHASIS_3 = COLOR_DEEMPHASIS_2;

    function deemphasize (text: string, next?: (text: string) => ContentItemOrList): ContentItemOrList {
      const numPrefixChars = text.match(/^~*/)![0].length;
      text = text.slice(numPrefixChars);
      const message: ContentItemOrList = next?.(text) ?? text;
      switch (numPrefixChars) {
        case 0: return message;
        case 1: return ConsoleMessage(message, {
          'color': COLOR_DEEMPHASIS_1,
        });
        case 2: return ConsoleMessage(message, {
          'color': COLOR_DEEMPHASIS_2,
        });
        default: return ConsoleMessage(message, {
          'color': COLOR_DEEMPHASIS_3,
          'text-decoration': 'line-through',
        });
      }
    }

    function boldWords (text: string, next?: (text: string) => ContentItemOrList): ContentItemOrList {
      const rawSegments = text.split(/\*\*/g);
      if (rawSegments.length === 1) return next?.(text) ?? text;
      const formattedSegments: any[] = [];
      for (let i = 0; i < rawSegments.length; i++) {
        const s = rawSegments[i];
        if (s.length === 0) continue;
        const message = next?.(s) ?? s;
        formattedSegments.push(i % 2 === 1 ? ConsoleMessage(message, { 'font-weight': 'bold' }) : message);
      }
      return formattedSegments.length === 1 ? formattedSegments[0] : formattedSegments;
    }

    function italicWords (text: string, next?: (text: string) => ContentItemOrList): ContentItemOrList {
      const rawSegments = text.split(/(?<=^|\s)_(?=\S)|(?<=\S)_(?=\s|$)/g);
      if (rawSegments.length === 1) return text;
      const formattedSegments: any[] = [];
      for (let i = 0; i < rawSegments.length; i++) {
        const s = rawSegments[i];
        if (s.length === 0) continue;
        formattedSegments.push(i % 2 === 1 ? ConsoleMessage(s, { 'font-style': 'italic' }) : s);
      }
      return formattedSegments.length === 1 ? formattedSegments[0] : formattedSegments;
    }

    function bulleted (text: string, next?: (text: string) => ContentItemOrList): ContentItemOrList {
      // If we aren't forcing a style on the bullet, then it's plain text and the other formatters will be able to apply
      // their styles to the bullet:

      // if (text.startsWith('- ')) text = '\u2022 ' + text.slice(2);
      // return next?.(text) ?? text;

      // If we ARE forcing a style on the bullet, then we need to apply the other formatters to the text after the bullet,
      // and then we'll wrap the returned message in one of our own, giving us control over the bullet's style:

      if (!text.startsWith('- ')) return next?.(text) ?? text;
      text = text.slice(2);
      const msg = next?.(text) ?? text;
      return ConsoleMessage([ConsoleMessage('\u2022 ', MaterialSC.red[500]), msg]);
    }
  }
}

