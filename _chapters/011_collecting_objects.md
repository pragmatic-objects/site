---
layout: post
title: Collecting objects
description: About a role of different kinds of collections
date: 2019-09-19T00:00:00+03:00
---

Recenty, in one of the [Cactoos](https://github.com/yegor256/cactoos) issues, I noticed the following [proposal](https://github.com/yegor256/cactoos/issues/898#issuecomment-532872843) from one of its maintainers --- [Fabricio Cabral](https://github.com/fabriciofx):

> I don't like the idea of mutable collections or even mutable classes in Cactoos. To me, it's thw wrong approach to this problem. My suggestion is to implement a Persistent Data Structure (there's a nice discussion about it here) to make our collections trully immutable. WDYT?

I found this concern curious. In the issue comments, I gave a [short](https://github.com/yegor256/cactoos/issues/898#issuecomment-533582638) comment, just to avoid raising deep discussions in irrelevant issues:

> @fabriciofx I'll just answer that I am neutral to this. Generally, I have no certain favourite between mutable or persistent collections, both have a right to live.

But the subject is really interesting, so I decided to elaborate on it in this post.

## Mutable collections vs Persistent collections

A bit of dull theory. Mutable collections are collections, which allow mutation of their state in place. Examples are the majority of standard collections from `java.util`. When you add or remove elements there, you get the changes at all places which keep a reference to the collection instance.

Persistent collections are the collections, which persist their previous state when mutation operation is applied on them. When you apply mutation operation on such collection, you get a new independent instance of it, with updated content. Such characteristic makes them effectively immutable. There are plenty different implementations of persistent collections in Java ecosystem. I personally prefer collections from [Vavr](https://www.vavr.io/), mostly for historical reasons and simplicity.

At first glance it may seem like mutable collections are odd in the paradigm of Elegant Objects, since [mutability is tabooed there](https://www.yegor256.com/2014/06/09/objects-should-be-immutable.html). But I disagree. I believe both kinds have its place in the paradigm.

## Persistent collections

Consider the following examples:

```java
interface PuzzleSource {
    List<Puzzle> puzzles();
}

public class PuzzleSourceStatic implements PuzzleSource {
    private final List<Puzzle> puzzles;

    public PuzzleSourceStatic(List<Puzzle> puzzles) {
        this.puzzles = puzzles;
    }

    public PuzzleSourceStatic(Puzzle... puzzles) {
        this(List.of(puzzles));
    }

    @Override
    public final List<Puzzle> puzzles() {
        return puzzles;
    }
}

public class PuzzleSourceCombined implements PuzzleSource {
    private final List<PuzzleSource> sources;

    public PuzzleSourceCombined(List<PuzzleSource> sources) {
        this.sources = sources;
    }

    @Override
    public final List<Puzzle> puzzles() {
        return sources.flatMap(ps -> ps.puzzles());
    }
}
```

Those classes where taken from [Puzzlerbot](https://github.com/skapral/puzzlerbot) --- a bot for making [PDD](https://www.yegor256.com/2010/03/04/pdd.html) outside the code. `PuzzleSource` here is an entity, that stands for all puzzles declared within certain scope (issue or pull request).
`PuzzleSourceStatic` is just an object with fixed set of pre-defined puzzles. `PuzzleSourceCombined` just merges puzzles from different sources together. Notice `List` declaration in the attributes of `PuzzleSourceStatic` and `PuzzleSourceCombined`? This is `io.vavr.collection.List` --- a persistent immutable list provided by Vavr.

What is *identity* of the `PuzzleSourceStatic` class, that makes its instances unique or [equivalent](009_equivalence_101.html)? The answer is: the list of puzzles. Providing different puzzles to `PuzzleSourceStatic`, we'll get instances that behave in different ways. Providing same list of puzzles, we'll get two instances of `PuzzleSourceStatic`, behavior of which will be exactly the same. The same principle works for `PuzzleSourceCombined`.

Since the list of puzzles is the identity of `PuzzleSourceStatic`, it's in our interest to make it immutable. That's why my choice here is the immutable collection.

## Mutable collections

Consider the following example:

```java
class Counter {
    private final Map<String, Integer> cache;
    private final String name;

    public Counter(String name, Map<String, Integer> cache) {
        this.name = name;
        this.cache = cache;
    }
    
    public final Integer next() {
        return cache.compute(name, (key, value) -> {
            if(Objects.isNull(value)) {
                return 0;
            } else {
                return value++;
            }
        });
    }
}
```

This is slightly redesigned class from the post about [equivalence](009_equivalence_101.html). A counter class.

What is *identity* of the class? A pair of `{name, cache}`. Two instances provided with the same name and cache will behave like the one. Two instances provided with different name or cache will behave independently.

But at the same time, cache *contents* are not the identity of `Counter`. Only the reference to the cache is. That's why immutability here is important only for the reference `cache`, which is made `final`. Not for the collection itself. On the contrary, making collection immutable would bring us troubles here, since the object would loose the only place where it can store the *state* of the counter it stands for. State, that is mutable *by definition*.

## Collections from objects-data dualism perspective

As I stated before, [code and data worlds are different in their nature](010_objects_and_data.html#objects-vs-data). If we are saying that objects, as a representatives of code world, must be immutable, it doesn't mean that we should apply the same principle to the data. We can't get rid of one side in favour of another: both code and data are equally important. That's why questions like "which collections are better" are dangerous and harmful. Both are useful in their niche.

Persistent collections have good characteristics in code world: they make work with them more predictable, testable and transparent. That's what makes them good for keeping *identity*. But at data world, they lead to extra expences in terms of memory consumption and copying, and their immutable nature may cause inconveniences, when there are lots of writes on them.

Mutable collections have decent characteristics in data world: they are fast, cheap and flexible. Which make them good candidates for keeping *state* in memory. But at code world, they are the source of undesirable side effects.

Don't neglect one or the other, but choose wisely.
