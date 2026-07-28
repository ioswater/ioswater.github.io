---
title: Code Blocks
description: Syntax highlighting for OC / Swift / C / C++ and the antd-style minimal code block showcase.
lastUpdated: 2026-07-28
---

This page demonstrates the documentation site's code block capabilities: syntax highlighting for **Objective-C**, **Swift**, **C**, and **C++**, presented in an antd-style minimal card (rounded corners, light background, restrained language label, hover-to-copy).

## Swift

Isolate the network transport layer with an `actor` to avoid shared mutable state:

```swift
import Foundation

struct Endpoint {
    let path: String
    let method: HTTPMethod
    let query: [URLQueryItem]
}

actor NetworkTransport {
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw TransportError.invalidResponse
        }
        return (data, http)
    }
}
```

## Objective-C

A minimal LRU cache interface (`.h`). You can also write ` ```objc ` or ` ```oc ` — both are equivalent:

```objc
// LRUCache.h
#import <Foundation/Foundation.h>

@interface LRUCache : NSObject

@property (nonatomic, assign, readonly) NSUInteger capacity;

- (instancetype)initWithCapacity:(NSUInteger)capacity;
- (id)objectForKey:(NSString *)key;
- (void)setObject:(id)object forKey:(NSString *)key;

@end
```

Using the `oc` alias (equivalent to the block above, both highlighted):

```oc
@implementation LRUCache

- (instancetype)initWithCapacity:(NSUInteger)capacity {
    if (self = [super init]) {
        _capacity = capacity;
        _store = [NSMutableOrderedSet orderedSet];
        _map = [NSMutableDictionary dictionary];
    }
    return self;
}

@end
```

## C

A lock-free ring buffer pointer-advance helper:

```c
#include <stdint.h>

// Lock-free ring buffer write pointer advance (mask is 2^n - 1)
static inline uint32_t ring_advance(uint32_t pos, uint32_t step, uint32_t mask) {
    return (pos + step) & mask;
}

int clamp(int value, int lo, int hi) {
    return value < lo ? lo : (value > hi ? hi : value);
}
```

## C++

Protect an internal container with RAII `std::lock_guard`:

```cpp
#include <mutex>
#include <vector>

class Counter {
public:
    void add(int n) {
        std::lock_guard<std::mutex> lock(mutex_);
        values_.push_back(n);
    }

    std::size_t size() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return values_.size();
    }

private:
    mutable std::mutex mutex_;
    std::vector<int> values_;
};
```

## Advanced: line highlighting and line numbers

Swift snippet with highlighted lines (marked with `{2-4}`):

```swift {2-4}
func fetchUser(id: Int) async throws -> User {
    let url = base.appending(path: "users/\(id)")
    var request = URLRequest(url: url)
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    return try await decoder.decode(User.self, from: try await data(for: request))
}
```

Enable line numbers (append `showLineNumbers` after the language):

```cpp showLineNumbers
#include <iostream>

int main() {
    std::cout << "hello, liuluit" << std::endl;
    return 0;
}
```
