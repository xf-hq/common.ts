# `ConsoleMessage` (`cmsg`) Usage Guide

This guide provides a concise set of examples to demonstrate how to use the `ConsoleMessage` (`cmsg`) facility for creating rich, styled messages in the browser's developer console.

## 1. Core Concepts

### 1.1. Creating and Styling a Message

The `cmsg` function is the core of the facility. It accepts content to be displayed and an optional CSS style object.

```typescript
// A simple, unstyled message.
cmsg('Hello world').print();

// A styled message.
cmsg('Hello styled world', {
  'color': 'tomato',
  'font-size': '1.5em',
  'font-weight': 'bold',
  'text-shadow': '2px 2px 4px #000000'
}).print();
```

### 1.2. Composing Messages

Messages can be composed by passing an array of strings and other `cmsg` instances. This allows for the creation of complex, multi-styled log entries.

```typescript
cmsg([
  'User: ',
  cmsg('axefrog', { 'color': 'cyan', 'font-weight': 'bold' }),
  ' logged in.'
]).print();
```

### 1.3. Printing to the Console

Messages can be printed directly or within collapsible groups.

```typescript
// Simple print:
cmsg('A simple message.').print();

// Collapsed group using printGroup():
cmsg('Details for process 123').printGroup(() => {
  cmsg.print('Status: OK');
  cmsg.print('Timestamp:', new Date());
});

// Manually controlled group, useful for when you want to manually control when to end the group.
const group = cmsg('Processing...').setMode('group').beginPrint();
setTimeout(() => {
  console.log('Step 1 complete.');
  setTimeout(() => {
    console.log('Step 2 complete.');
    group.endPrint();
  }, 500);
}, 500);
```

## 2. The Standard Namespace (`cmsg.std`)

The `cmsg.std` namespace provides a collection of pre-built formatters and helpers for common logging scenarios.

### 2.1. Text and Code Formatting

Helpers for styling text that represents code entities, such as keywords, type names, and function names. The `punctuated` helper adds appropriate spacing around its items.

```typescript
cmsg.std.punctuated([
  cmsg.std.keyword('new'),
  cmsg.std.typeName('User'),
  '(',
  cmsg.std.fieldName('name'),
  ':',
  cmsg(`'John Doe'`, { color: '#a5d6a7' }), // String literal
  ')'
]).print();
```

### 2.2. Material Colors (`cmsg.std.mc`)

A rich color palette based on Material Design colors is available under `cmsg.std.mc`. Helpers for `.bold` and `.italic` text are also included.

```typescript
cmsg([ cmsg.std.mc.lightBlue.bold('INFO'),  ': This is an informational message.' ]).print();
cmsg([ cmsg.std.mc.amber.bold('WARN'),  ': Something might be wrong.' ]).print();
cmsg([ cmsg.std.mc.red[700].bold('ERROR'), ': An error occurred.' ]).print();
```

### 2.3. Structured Formatting

Helpers for creating common structural patterns like labels and bracketed text.

```typescript
// A labelled message with a custom background color.
cmsg.std.labelled.bg('blue').white('SYSTEM', 'Server is starting...').print();

// A message enclosed in square brackets (`mc` is an acronym for "Material Color").
cmsg.std.squareBracketed(cmsg.std.mc.lightGreen('OK')).print();
```

## 3. Advanced Patterns & Recipes

### 3.1. Attaching Raw Data

Use `args()` to include raw, inspectable objects in the console output alongside a styled message. This is useful for logging complex data structures.

```typescript
const user = { id: 1, name: 'Jane Doe', roles: ['admin', 'editor'] };
cmsg([ 'User object: ', cmsg.std.typeName('User') ]).args(user).print();
// Equivalent to: console.log('User object: %cUser', '<..styles..>', user);
```

### 3.2. Recipe: Performance Logging

Here is a practical example of how to combine several features to log performance measurements.

```typescript
function doWork () {
  performance.mark('work-start');
  // ... some synchronous work ...
  performance.mark('work-end');
  const measure = performance.measure('doWork', 'work-start', 'work-end');

  cmsg.std.labelled.bg('purple').white('PERF',
    cmsg.std.punctuated([
      cmsg.std.functionName('doWork'),
      'took',
      cmsg(measure.duration.toFixed(2) + 'ms', { color: '#90caf9' })
    ])
  ).args(measure).print();
}
doWork();
```

### 3.3. Recipe: Reusable Labels

You can create your own reusable, complex message components for consistent logging of important events like warnings or errors.

```typescript
const WIP_LABEL = cmsg([` WORK IN PROGRESS `], {
  'font-weight': 'bold',
  'color': '#ffeb3b',
  'background-color': 'black',
}).spaceAround();

WIP_LABEL.print();
```

## Appendix: Relevant Source Code

- **Core Implementation:** [`console-message.ts`](console-message.ts)
- **Standard Namespace:** [`console-message.standard-ns.ts`](console-message.standard-ns.ts)
- **Usage Cookbook:** [`console-message.cookbook.ts`](console-message.cookbook.ts)
