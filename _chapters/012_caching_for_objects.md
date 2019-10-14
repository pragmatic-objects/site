---
layout: post
title: Caching for objects
description: Elegant objects caching and memoization done right
date: 2019-10-11T00:00:00+03:00
---

Some time ago, in the post dedicated to [possible pitfalls of decorating objects](008_things-i-would-never-place-in-decorators.html), I mentioned that:

> In my opinion, caching and memoization in Elegant objects is one of the most difficult subjects, which has not been fully revealed by Yegor in his books and blogposts. There are more caveats that may seem to at first glance.

It's time to elaborate on this subject in detail.

## Existing solutions

Currently, Elegant Objects ecosystem provides various tools for caching certain calculations made inside objects. There is [jcabi-aspects](https://aspects.jcabi.com/annotation-cacheable.html), which gives simple aspects for caching methods results:

```java
public class Resource {
  @Cacheable(lifetime = 5, unit = TimeUnit.SECONDS)
  public String load(URL url) {
    return url.openConnection().getContent();
  }
}
```

Also there is [Cactoos](https://github.com/yegor256/cactoos) which does the similar thing by means of so-called ["sticky" decorators](https://www.yegor256.com/2017/10/17/lazy-loading-caching-sticky-cactoos.html) (notice `StickyScalar` in the example below):

```java
class Encrypted5 implements Encrypted {
  private final IoCheckedScalar<String> text;

  Encrypted5(Scalar<String> source) {
    this.text = new IoCheckedScalar<>(
      new StickyScalar<>(source)
    );
  }
}
```

Both ways are insufficient, if you ask me. There are certain limitations which these tools bring up --- rather crucial ones.

## What kind of limitations?

In short, each caching and/or memoization act is always based on some mutable state. And each mutable state, while being a part of the [data world](010_objects_and_data.html#objects-vs-data), is a matter of [ACID](https://en.wikipedia.org/wiki/ACID). Neither jcabi-aspects, nor Cactoos takes this into account.

Lets assume some system which operates with users:

```java
interface User {
    String name();
}
```

Whatever code works with the user, it will expect certain guarantees from `User` implementations. For example, the calling object, which stands for some transaction, may call the `name()` method several times, and expect it to return the same string:

```java
class Purchase {
    private final User recipient;
    private final Address deliveryAddress;
    private final DeliveryService service;

    // Ctor

    private final void make() {
        service.deliver(
            recipient.name(), address.address()
        )
    }
}

new PurchaseDelivery(
    new User("skapral"),
    new AddressForUser(
        new User("skapral")
    ),
    new Fedex()
).make()
```

`Purchase` is a composite object, composed from smaller ones. `User` takes part in this composite multiple times. If `new User("skapral").name()` returned different names to `AddressForUser` and for recipient, it could lead to unpredictable effects, like incorrectly delivered package. 

For various implementations of user, this consistency is easy to achieve:

```java
class StaticUser implements User {
    private final String name;

    public StaticUser(String name) {
        this.name = name;
    }

    public final String name() {
        return name;
    }
}
```

`StaticUser` above has fixed name, so no matter how much and where you call it for `name()`, result will always be the same. But objects are rarely that simple. Check another implementation:

```java
class GithubUser implements User {
    private final String apiToken;

    public GithubUser(String apiToken) {
        this.apiToken = apiToken;
    }

    @Override
    public final String name() {
        try {
            Github github = new RtGithub(apiToken);
            com.jcabi.github.User self = github.users().self();
            return self.login();
        } catch(IOException ex) {
            throw new RuntimeException(ex);
        }
    }
}
```

This one extracts user name from GitHub account, using [jcabi-github](https://github.com/jcabi/jcabi-github) library.
However, theoretically, GitHub user can change its name at any time, even in the middle of your application's transaction. So there is no such level of consistency, as for `StaticUser`. Calling method `GithubUser::name` multiple times, you can get different names.

In the world of data, this issue has the name "dirty read". `GithubUser`, while being a part of your application's transaction, can read updates, made by outer world (GitHub). Sometimes such level of isolation can be sufficient,
but in majority of cases it is not.

Theoretically, we can compensate this effect by enabling method caching for `name()` by using `@Cacheable` jcabi-aspects annotation:

```java
class GithubUser implements User {
    private final String apiToken;

    public GithubUser(String apiToken) {
        this.apiToken = apiToken;
    }

    @Override
    @Cacheable(lifetime = 5, unit = TimeUnit.SECONDS)
    public final String name() {
        try {
            Github github = new RtGithub(apiToken);
            com.jcabi.github.User self = github.users().self();
            return self.login();
        } catch(IOException ex) {
            throw new RuntimeException(ex);
        }
    }
}
```

But on the second thought, it is not a solution. First, because nobody said that 5 seconds is sufficient --- your application's transaction may last for longer time. Second, even if we make lifetime infinite, it'd just mean that memoized value of `GithubUser` will be stored forever inside the instance of the object. And that in turn means that once `GithubUser` took participation in one transaction, the cached name becomes stalled for the next one. Which is deadly.

The same problem lies in design of Cactoos. If we dig inside internals of Cactoos and find a place where it does memoization of `StickyScalar`'s calculations, we'll find this `StickyBiFunc` class:

```java
public final class StickyBiFunc<X, Y, Z> implements BiFunc<X, Y, Z> {
    private final BiFunc<X, Y, Z> func;
    private final Map<Map.Entry<X, Y>, Z> cache;
    private final int size;

    public StickyBiFunc(final BiFunc<X, Y, Z> fnc) {
        this(fnc, Integer.MAX_VALUE);
    }

    public StickyBiFunc(final BiFunc<X, Y, Z> fnc, final int max) {
        this.func = fnc;
        this.cache = new LinkedHashMap<>(0);
        this.size = max;
    }

    @Override
    public Z apply(final X first, final Y second) throws Exception {
        final Map.Entry<X, Y> key = new MapEntry<>(first, second);
        while (this.cache.size() > this.size) {
            this.cache.remove(this.cache.keySet().iterator().next());
        }
        if (!this.cache.containsKey(key)) {
            this.cache.put(key, this.func.apply(first, second));
        }
        return this.cache.get(key);
    }
}
```

Notice two things about it:

- its `cache` attribute is hardwired to `LinkedHashMap` instance straight inside constructor. There is no way of providing a map from outside.
- its `cache` contents cannot be invalidated on demand. There is a logic for purging cache contents to prevent it from growing infinitely (check the `while` loop inside), but it is not enough.

Summing up these two facts leads us to conclusion that there is no way to purify, to *invalidate* the cache located inside `StickyBiFunc`, which in turn potentially leads us to same problem of stalled reads from cache between transactions.


## Reproducability

Another thing which I don't like about existing caching solutions is the absence of reproducability. This problem can be illustrated with the following code snippet:

```java
new GithubUser("abcdef123456").name(); // cache missed, call to Github API will be made
new GithubUser("abcdef123456").name(); // cache missed again! The object is different, while its identity is the same to the previous instance.
```

If I have an instance of `GithubUser`, annotated with `@Cacheable` annotation, its cache contents are melded to the instance of `GithubUser`.
And if I reinstantiate the `GithubUser` with the same `githubApi` token, cache contents won't be reused for new instance. New instance will have its own cache. 
Which is suboptimal: two `GithubUser` with same `githubApi` will be [equivalent](009_equivalence_101.html), their behavior will be exactly the same, so reusing cached value for both of them makes sense.

## Alternative

Lets introduce a separate contract for cache:

```java
interface Memory {
    <S, T> T memoizedCalculation(S source, Object key, Supplier<T> calculation);
    void reset();
}
```

This is the place where we will keep the cache records. Every calculation, that is supposed to be cached, we wrap up by calling `memoizedCalculation` method. The pair of `[source, key]` will be the cache key, by which memoized values will be resolved inside `Memory` instances. And in order to invalidate the cache, there is `reset()` method.

By implementing `Memory`, we may introduce different sorts of cache storages. Below is the example of a simple cache, which will store memoized values inside `ConcurrentHashMap`:

```java
public class MemoryCHM implements Memory {
    private final ConcurrentHashMap memoizedObjects;

    public MemoryCHM(ConcurrentHashMap memoizedObjects) {
        this.memoizedObjects = memoizedObjects;
    }

    @Override
    public final <S, T> Calculation<T> memoizedCalculation(S that, Object key, Supplier<T> calculation) {
        return memoizedObjects.computeIfAbsent(
            Arrays.asList(that, key),
            mref -> calculation.apply().
        );
    }

    @Override
    public final void clean() {
        memoizedObjects.clear();
    }
}
```

Theoretically, `Memory` could be implemented in various ways, providing different kinds of storages with different characteristics for memoized values. It can be implemented around HTTP session storage (for session-scoped values).
Or around `ThreadLocal` (for memoized values associated with certain thread). One can implement it around a file or database (and get persistent cache storage),
or store the memoized values in distributed caching solutions, like [Ehcache](https://www.ehcache.org/) or [Hazelcast](https://hazelcast.org/).

## Tier 1: method-level caching

This is pretty straightforward. Provided that you have a method, result of which needs to be cached, you should:
- add a `Memory` attribute to your object
- wrap up calculation by means of calling `Memory::memoizedCalculation`

```java
class GithubUser implements User {
    private final String apiToken;
    private final Memory memory;

    public GithubUser(String apiToken, Memory memory) {
        this.apiToken = apiToken;
        this.memory = memory;
    }

    @Override
    public final String name() {
        return memory.memoizedCalculation(
            this,
            "name",
            () -> {
                try {
                    Github github = new RtGithub(apiToken);
                    com.jcabi.github.User self = github.users().self();
                    return self.login();
                } catch(IOException ex) {
                    throw new RuntimeException(ex);
                }
            }
        )
    }
}
```

First argument of `memoizedCalculation` in most cases should always be `this`. The trick here is in [objects equivalence](009_equivalence_101.html).
Even if we reinstantiate GithubUser anew with the same pair of `[apiToken, memory]`, the cache state will preserve:

```
ConcurrentHashMap chm = new ConcurrentHashMap();
new GuthubUser("abcdef123456", new MemoryCHM(chm)).name(); // cache warmup, call to Github API will be made
new GuthubUser("abcdef123456", new MemoryCHM(chm)).name(); // cache hits here, memoized value will be returned.
```

Note however that since Java doesn't provide equivalence logic out of the box, the trick above will work only if you instrument your classes by [OO-Equivalence](https://github.com/pragmatic-objects/oo-equivalence/).

Slightly improved `Memory` and `MemoryCHM` implementations you can find in the project [OO-Memoized](https://github.com/pragmatic-objects/oo-memoized/).

## Tier 2: object-level caching

For one-method function-like objects tier 1 would be sufficient. But objects can have more than one methods. Lets imagine that GithubUser, along with name, provides also a list of user's emails:

```java
interface User {
    String name();
    Iterable<String> emails();
}

class GithubUser implements User {
    private final String apiToken;

    public GithubUser(String apiToken) {
        this.apiToken = apiToken;
    }

    @Override
    public final String name() {
        try {
            Github github = new RtGithub(apiToken);
            com.jcabi.github.User self = github.users().self();
            return self.login();
        } catch(IOException ex) {
            throw new RuntimeException(ex);
        }
    }

    @Override
    public final Iterable<String> emails() {
        try {
            Github github = new RtGithub(apiToken);
            com.jcabi.github.User self = github.users().self();
            return self.emails();
        } catch(IOException ex) {
            throw new RuntimeException(ex);
        }
    }
}
```

Such straight implementation of `GithubUser` is deadly suboptimal. On each method call it does a separate call to the Github API, just for the sake of extracting a small piece of data. And even if we cache `name()` and `emails()` on methods level, there still can be at most two API calls per transaction --- one for `name()` call, one for `emails()`.

There should be a way to fixate the whole user object at the first call to Github API. And there is a way for it.

First, lets introduce new contract:

```java
interface Inference<T> {
    T inferredInstance();
}
```

Implementors of `Inference` will *infer* the object's behavior at runtime. To use that with user, we need inferred user's implementation:

```java
public class UserInferred implements User {
    private final Inference<User> inference;

    public UserInferred(Inference<User> inference) {
        this.inference = inference;
    }

    @Override
    public final String name() {
        return inference.inferredInstance().name();
    }

    @Override
    public final Iterable emails() {
        return inference.inferredInstance().emails();
    }

}
```

What's the trick with these inferences? The trick is that we can decorate them like any other objects. Here is the decorator, which is able to memoize inferred instance in `Memory`:

```java
public class MemoizedInference<T> implements Inference<T> {
    private final Inference<T> inference;
    private final Memory memory;

    public MemoizedInference(Inference<T> inference, Memory memory) {
        this.inference = inference;
        this.memory = memory;
    }

    @Override
    public final T inferredInstance() {
        return memory
            .memoizedCalculation(this, "inferredObject", inference::inferredInstance)
            .calculate();
    }
}
```


Now, if we wrap Github API call to the inference, we can memoize its result pretty easily:

```java
public class GithubUserInference implements Inference<User> {
    private final String apiToken;

    public GithubUserInference(String apiToken) {
        this.apiToken = apiToken;
    }

    @Override
    public final User inferredInstance() {
        try {
            Github github = new RtGithub(apiToken);
            com.jcabi.github.User self = github.users().self();
            return new StaticUser(self.login(), self.emails().iterate());    
        } catch(IOException ex) {
            throw new RuntimeException(ex);
        }
    }
}


public class GithubUser extends UserInferred {
    public GithubUser(String apiToken, Memory memory) {
        super(
            new MemoizedInference(
                new GithubUserInference(apiToken),
                memory
            )
        );
    }
}
```

At the end, we are getting `GithubUser` which does memoization of Github API call one time per the whole thing:

```java
ConcurrentHashMap chm = new ConcurrentHashMap();
new GithubUser("githubapitoken", new MemoryCHM(chm)).name(); // cache missed, Github API is called here
new GithubUser("githubapitoken", new MemoryCHM(chm)).emails(); // cache hit, call is delegated to memoized instance of user
```

Of course, there is plenty of boilerplate for all these inferences and inferred implementations. To eliminate it, [OO-Inference](https://github.com/pragmatic-objects/oo-inference) was introduced.
It is annotation generator, which generates sources for all the stuff automatically: all you need is just to provide an `Inference` implementation.


