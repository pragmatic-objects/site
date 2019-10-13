---
layout: post
title: "Four things I would never place into decorators"
description: Not every decorator is equally helpful
date: 2019-06-28T00:00:00+03:00
---

For everyone who is familiar with Elegant Objects, it's not a secret that Yegor Bugayenko loves decorators. There are decades of posts about different ways of decorating different stuff.
It might feel like decorators are a universal pattern for everything in Elegant Objects. But in my practice I came to conclusion that certain logic should never be placed in decorators, no matter how
tempting it is.

## Equality logic

One of such logic I already mentioned in my post about [objects equality](004_object_equivalence.html). Equality logic. Sometimes it is a big temptation to place equality logic to a decorator. Like in this example:

```java
interface User {
  String name();
}

class FixedUser {
  private final String name;

  public FixedUser(String name) {
    this.name = name;
  }

  public final String name() {
    return name;
  }
}

class ComparableUser implements User {
  private final User origin;

  // ctors
  public final String name() {
    return origin.name();
  }

  @Override
  public boolean equals(Object that) {
    if (obj instanceof User) {
      final User other = (User) obj;
      return Objects.equals(this.origin.name(), that.name());
    }
    return false;
  }
}

```

The problem is: you don't know what `User` instance encapsulates. If it is just a simplest implementation with fixed data inside, like `FixedUser`, then it is okay to pass it to `ComparableUser::equals`. But what if 
there is another `User` implementation? Like `GithubUser`, which extracts user's name by calling Github API in `name()` method:

```java
class GithubUser implements User {
    private final String apiToken;

    public GithubUser(String apiToken) {
        this.apiToken = apiToken;
    }

    public final String name() {
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.github.com/user"))
            .header("Authorization", "token " + apiToken)
            .build();
        return client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
              .thenApply(HttpResponse::body)
              .thenApply(resp -> JsonPath.read(resp, "login").toString())
              .join();
    }
}
```


Calling third party remote API is quite heavy operation --- how would `HashMap` with `ComparableUser` key behave? Also there is no guarantee that one day `GithubUser::name()` won't return us some other name for the user and break the consistency of `equals` result.

Alternative? First of all, embrace that there is [no such thing as equality for objects](004_object_equivalence.html). Second --- admit, that all objects have [equivalence](009_equivalence_101.html) trait, and let [OO-Equivalence](https://github.com/pragmatic-objects/oo-equivalence) generate it for you.

## Caching and memoization

In my opinion, caching and memoization in Elegant objects is one of the most difficult subjects, which has not been fully revealed by Yegor in his books and blogposts. There are more caveats 
that may seem to at first glance. [Caching for objects](012_caching_for_objects.html) is elaborated in a separate post.

Consider `GithubUser` from the previous chapter. In its `name` implemetation, it is calling Github API for getting the user's name for some business purposes. Github API call is too heavy stuff to make it on every call to `name()`,
and it is logical to preserve the result for certain period once it was obtained. On the first glance, it might be tempting to write `CachingUser` decorator for such purposes.

```java
class CachedUser implements User {
    private final User user;
 
    public CachedUser(User user) {
        this.user = user;
    }
    
    @Override
    @Cacheable(lifetime = 15, unit = TimeUnit.SECONDS)
    public String name() {
        return user.name();
    }
}
```

The usage of such decorator is straight-forward. Once I want to preserve results provided 
by instance of `GithubUser`, I wrap it to `CachedUser` and call it instead. Simple as it sounds.

However, if we take into account the calling side, it becomes more cumbersome. Consider some imaginery `UserTransaction` class, 
which encapsulates a complex set of actions based on user name to put some money on the user's account:

```java
class UserTransaction {
    private final User user;
    private final Money money;
    private final Audit audit;

    public UserTransaction(User user, Money money, Audit audit) {
        this.user = user;
        this.money = money;
        this.audit = audit;
    }

    public void submit() {
        // 1. Finds user's banking account
        // 2. Updates the money amount on it
        // 3. Logs the transaction in some audit system
    }
}
```

The first problem is that `UserTransaction` instances will work correctly only if the call to `this.user.name()` returns the same result within the whole `submit()` scope. If we cannot guarantee that, we can
theoretically get a situation when on step 1 we get banking account by one user's name, and on step 3 we log another user to the audit system. That's why we can expect adequate work from these two objects:

```java
new UserTransaction(
    new FixedUser("skapral")
);

new UserTransaction(
    new CachedUser(
        new GithubUser(...)
    )
);
```

...but can't expect the same from this one, while nothing prevents us from instantiating it:

```java
new UserTransaction(
    new GithubUser(...)
);
```

The second problem with caching decorators is the fact that all caches and memoization usually has certain scope. 
Consider `UserTransaction` with cached github user inside. What will be if we call its `submit()` method ten times in a row, and somewhere in the middle user will change its name in Github account profile?
In theory, we'd want to get this update in the beginning of a new `UserTransaction::submit()` call. Practically, the old name would stay cached until we reinstantiate the `CachedUser`, or its cache lifetime is over. Not good.

And the third problem is: nothing prevents us from instantiating this useless object, which will perform badly and obtain too much memory for nothing:

```java
new CachedUser(
  new CachedUser(
    new CachedUser(
      new FixedUser("skapral")
    )
  )
)
```

You may say that it is unrealistic and nobody would ever do it, but imagine that such composition is not located in one place, but spread among different [envelopes](https://www.yegor256.com/2017/01/31/decorating-envelopes.html) or [aliases](https://www.pragmaticobjects.com/chapters/005_implementation_inheritance_paranoia.html#aliases)? Such mistake would be quite hard to localize.

## Thread safety

Thread safety by decorators was raised in the [post](https://www.yegor256.com/2019/06/26/syncem.html) dedicated to SyncEm Ruby library, which was created for automatically making thread safe objects from thread unsafe ones by wrapping them by decorators. The whole idea of making thread safety by means of decorators (automatically or manually --- doesn't matter) sounds controversial to me.

Lets imagine that we have the use case from the Yegors post. We need to count some visitors:

```java
interface Visitors {
  int increment();
  int get();
}
```

We also need this counter to be thread-safe. If we made thread safe `Visitors` implementation from scratch --- it would be pretty simple and straightforward:

```java
class ThreadSafeVisitors implements Visitors {
    private final AtomicInteger integer;

    public ThreadSafeVisitors(AtomicInteger integer) {
        this.integer = integer;
    }
    
    public final int increment() {
        return integer.incrementAndGet();
    }
    
    public final int get() {
        return integer.get();
    }
}
```

But if we are assuming initially that there is thread unsafe `Visitors` implementation and we must implement a thread-safe decorator or it, things become more complicated. We could try making it straight:

```java
class ThreadSafeVisitors implements Visitors {
    private final Visitors threadUnsafeVisitors;

    public ThreadSafeVisitors(Visitors visitors) {
        this.threadUnsafeVisitors = visitors;
    }

    public final synchronized int increment() {
        return this.threadUnsafeVisitors.increment();
    }

    public final synchronized int get() {
        return this.threadUnsafeVisitors.get();
    }
}
```

But straight way is not always the suitable one, especially when it is about thread safety. This implementation will perform much worse then the previous one, based on atomic integer, because of suboptimally-placed synchronization barriers. We could try making thread safe decorator by means of some reentrant locks, but it won't be as straight as the implementation based on `AtomicInteger`.

It's not the only concern here. The most crucial question is: why we need to introduce this complexity? For what purpose? If we think more about the purpose for the class to be thread safe, we'll realise that thread safety is characteristic, demanded by the calling side.
It's client code that is calling `Visitors` from many threads. So, if we define `Visitors` as attribute of a class that calls it from several threads and expects it to be thread-safe, doesn't it mean that according to [Liskov Substitution principle](https://en.wikipedia.org/wiki/Liskov_substitution_principle) all implementations of `Visitors` must be thread safe, without exceptions? Do we really need to make this trait to be outlined in decorator? I see no point in it.

## Logging/Tracing

Logging decorators were proposed in comments to the following [post](https://www.yegor256.com/2019/03/19/logging-without-static-logger.html). And in my opinion it is very controversial idea.

Lets assume `User` interface and `GithubUser` implementation again. We want to write `LoggedUser` decorator for it. What would we actually be able to log there?

```java
class LoggedUser implements User {
    private final User user;
    private final Logger log;

    public LoggedUser(User user) {
        this.user = user;
    }

    public String name() {
        String name = user.name();
        log.info("User name accessed: " + name);
        return name;
    }
}
```

At the context of `LoggedUser` there is only the user's name, available for logging? Not much. What such log would give to us? Nothing. At the same time, if we introduced logging straight inside `GithubUser` we'd be pretty easily able to log the request to API with all its headers, URL and input data, and response from it, with status code, headers and exact body. If `GithubUser` had a caching functionality inside, we'd be able also to trace the fact whether the user's name was obtained for cache or from API response. That would be indeed the informative and useful log.

## To sum up

Encapsulation is a great feature. But sometimes, encapsulation becomes an obstacle and source of pain, when the boundaries between objects are drawn in a wrong way. Decorators are one of the ways to draw these boundaries, and are not a universal panacea for everything. Such powerfull pattern doesn't take away from you the responsibility to split the logic to functionally-cohesive blocks of code (classes). Characteristics like equality, logging, caching and thread safety almost always exist a part of certain functional block, and almost never exist separately from the functionality they serve. Splitting functionally cohesive blocks to smaller parts leads to the same sort of maintainability mess as uniting non-cohesive functionality in one place, if not worse.

That's why I say: think seven times before placing the stuff above to a decorator.

