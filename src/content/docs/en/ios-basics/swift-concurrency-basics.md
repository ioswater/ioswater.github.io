---
title: Swift Concurrency Fundamentals
description: A practical baseline for async/await and TaskGroup.
lastUpdated: 2026-06-15
---

- Task is a unit of concurrent work, not a thread.
- await suspends; it does not block the thread.
- Use TaskGroup when child tasks are dynamic and independent.
