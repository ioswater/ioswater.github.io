---
title: 代码块示例
description: OC / Swift / C / C++ 语法高亮与 antd 极简代码块样式的展示与对照。
lastUpdated: 2026-07-28
---

本页用于演示文档站的代码块能力：支持 **Objective-C**、**Swift**、**C**、**C++** 的语法高亮，并采用 antd 风格的极简卡片外观（圆角、浅灰底、克制语言标签、悬停复制）。

## Swift

使用 `actor` 隔离网络传输层，避免共享可变状态：

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

一个最小 LRU 缓存接口（`.h`）。也可写作 ` ```objc ` 或 ` ```oc `（两者等价）：

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

用 `oc` 别名的写法（与上面等价，均高亮）：

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

一个无锁环形缓冲区的指针推进辅助函数：

```c
#include <stdint.h>

// 无锁环形缓冲区的写入指针推进（mask 为 2^n - 1）
static inline uint32_t ring_advance(uint32_t pos, uint32_t step, uint32_t mask) {
    return (pos + step) & mask;
}

int clamp(int value, int lo, int hi) {
    return value < lo ? lo : (value > hi ? hi : value);
}
```

## C++

用 RAII 的 `std::lock_guard` 保护内部容器：

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

## 进阶：行高亮与行号

带行高亮的 Swift 片段（用 `{2-4}` 标记重点行）：

```swift {2-4}
func fetchUser(id: Int) async throws -> User {
    let url = base.appending(path: "users/\(id)")
    var request = URLRequest(url: url)
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    return try await decoder.decode(User.self, from: try await data(for: request))
}
```

开启行号（在语言后追加 `showLineNumbers`）：

```cpp showLineNumbers
#include <iostream>

int main() {
    std::cout << "hello, liuluit" << std::endl;
    return 0;
}
```
