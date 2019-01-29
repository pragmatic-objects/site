---
layout: post
title: Never make classes final
description: Implementation inheritance is not yet the reason to keep classes final
date: 2018-08-29T13:00:00+03:00
---

The class of any Elegant object must be either 
[abstract or final](https://www.yegor256.com/2014/11/20/seven-virtues-of-good-object.html#7-his-class-is-either-final-or-abstract).
The intention behind this rule, I believe, was eliminating implementation inheritance as a kind. Drawbacks of 
inheritance and behefits of subtyping are rather [clear](https://www.yegor256.com/2016/09/13/inheritance-is-procedural.html), 
so I won't emphasize them here. However, in my practice I quickly realized that something is wrong with this rule.

Check the class
[`TeeInput`](https://github.com/yegor256/cactoos/blob/0.13.3/src/main/java/org/cactoos/io/TeeInput.java) from
[Cactoos](https://github.com/yegor256/cactoos) framework. I'll just quote a shortened version of it, but to get full 
impression, I recommend following the link.

```java
/**
 * Input to Output copying pipe.
 *
 * <p>There is no thread-safety guarantee.
 *
 * @author Yegor Bugayenko (yegor256@gmail.com)
 * @version $Id$
 * @since 0.1
 */
public final class TeeInput implements Input {

    /**
     * The source.
     */
    private final Input source;

    /**
     * The destination.
     */
    private final Output target;

    ///
    ///
    ///
    /// 72!!! constructors calling each other!
    ///
    ///
    ///

    @Override
    public InputStream stream() throws IOException {
        return new TeeInputStream(
            this.source.stream(), this.target.stream()
        );
    }
}
```

Bloody hell---seventy two constructors! About thousand lines of code, and 90% of them are constructors, which
[do nothing](https://www.yegor256.com/2015/05/07/ctors-must-be-code-free.html)! What kind of
maintainability is it?!

## Emotions aside

Lets look at these constructors closer. Main constructor, which sets the class members, is this one:

```java
public TeeInput(final Input input, final Output output) {
    this.source = input;
    this.target = output;
}
```

`Input` and `Output` are the interfaces from Cactoos---first produces `InputStream`, second---`OutputStream`. 
`TeeInput`'s behavior with these streams is similar to the `tee` Unix command: pipes through the input, 
writing it to the provided output. 

If we now check the secondary constructors, we'll notice that all of them are the shortcuts for typical usage of the 
class with files, URLs, input/output streams etc. They are here so that client code can use `TeeInput` without making 
object composition too deep and too verbose.

It all works smoothly, but leads to two issues:

### The number of constructors can grow quickly

For `TeeInput` class, having one `Input` attribute and one `Output` attribute, the possible exhaustive count of 
secondary constructors would be:

<img src="https://latex.codecogs.com/gif.latex?N_{Input}\times N_{Output}" border="0"/>

Where N is the number of the class implementations. The number is growing with:
- any new class attribute: this will add a new N to the equation above. Such thing as "new attribute" is less likely to 
happen with highly-cohesive and single-responcible class like `TeeInput` but still it is possible.
- any new subtype of the existing attribute's type---this on the other hand is typical situation for a 
highly-segregated interfaces like `Input` and `Output`.

Both these factors cause exhaustive number of constructors growing very quick, so 72 is not even a limit. 

Somebody may contradict that there is no need to define the exhaustive set of constructors, and it is true.
But when one need a constructor which is not defined, they will face another issue.

### The class is unextendable

Okay, we have `TeeInput` with dozens constructors. Now imagine that some developer took Cactoos framework and defined
a new subtype of `Input` over his own framework. Lets name it `InputFromUniverse`. What it actually does inside---doesn't matter. 

```java
class InputFromUniverse {
    private final UniverseCoordinates coords;
    
    public InputFromUniverse(UniverseCoordinates coords) {
        this.coords = coords;
    }
    
    @Override
    public InputStream stream() throws IOException {
        // some implementation
    }
}
```

The developer started composing it with different classes from Cactoos and noticed that some part of 
composition with `TeeInput` taking `InputFromUniverse` repeats very often:
 
```java
...
new TeeInput(
    new InputFromUniverse(
        new UniverseCoordinates(...)
    ),
    new OutputToFile(
        file
    )
)
...
```
 
In that case he would have a great temptation to eliminate the duplication---all he needs is a new secondary 
constructor for `TeeInput`, taking `UniverseCoordinates` and `File` arguments...
 
But the class is final. It is sealed, and one cannot extend it without modifying its source code. And the source code 
of `TeeInput` is in Cactoos, so the only option left for the poor developer is to repeat this composition over and 
over across his code. Not good for maintainability.

## So what---inheritance is evil anyway?

Yes, but at the same time subtyping is virtue.
The question is---does `extends` keyword from Java always means a source of troubles?

Lets imagine that the `TeeInput` class is not final and doesn't have any secondary constructors:

```java
public class TeeInput implements Input {
    private final Input source;
    private final Output target;

    public TeeInput(final Input input, final Output output) {
        this.source = input;
        this.target = output;
    }

    @Override
    public final InputStream stream() throws IOException {
        return new TeeInputStream(
            this.source.stream(), this.target.stream()
        );
    }
}
``` 

It's not that convenient for the client anymore, but it is short and self-sufficient. So---one want a shortcut around
some piece of composition? They are free to do that by extending it:

```java
public class TeeInputFromUriToFile extends TeeInput {
    public TeeInputFromUriToFile(final URI uri, final File file) {
        super(new InputFromUri(uri), new OutputToFile(file));
    }
}

public class TeeInputFromFileToFile extends TeeInput {
    public TeeInputFromFileToFile(final File input, final File output) {
        super(new InputFromFile(input), new OutputToFile(output));
    }
}

public class TeeInputFromUniverseToFile extends TeeInput {
    public TeeInputFromUniverseToFile(final UniverseCoordinates universeCoordinates, final File file) {
        super(new InputFromUniverse(universeCoordinates), new OutputToFile(file));
    }
}
```

Is it implementation inheritance? Maybe. But the more important question is: can we call these inheritors 
*subtypes* of `TeeInput`?

Look closer. All these inheritors have an interesting capability. *For any composition which operates 
with such inheritor, replacement of inheritor with the contents of its constructor would never change the composition's 
behavior*. For example, these two objects are equivalent:

```java
new TeeInputFromUrlToFile(
    "http://example.com/somefile",
    new File("/tmp/tempFile")
)
```
```java
new TeeInput(
    new InputFromUri(
        "http://example.com/somefile"
    ),
    new OutputFromFile(
        new File("/tmp/tempFile")
    )
)
```

They both are *guaranteed* to behave in the same way for any program which use them. Doesn't it sound 
[familiar](https://en.wikipedia.org/wiki/Liskov_substitution_principle)? The `TeeInputFromUrlToFile` actually is 
subtype of `TeeInput`.

However, this equivalence might be easily broken, if one  overrides the `stream` method in `TeeInput` inheritor. To 
prevent that, the method is intentionally made final. This will force the inheritors to inherit a class as a whole, 
not only parts of them.

The concept of reusing the class in such manner may look similar to 
[decorating envelopes](https://www.yegor256.com/2017/01/31/decorating-envelopes.html) approach. I totally for the 
idea---it's really nice and handy approach for safe object-oriented code reuse. But what I can't get is why should we 
prohibit applying it on any honest "Elegant" class by making it `final`? It makes no sense. Any class can be subtyped
in such manner, without exclusions. Making them `final` is just putting useless artificial obstacles, making the code
hard to extend without modifications, violating [OCP](https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle).

To sum up: never make "Elegant" classes `final`---it is harmful and gives no benefits. Instead---make all its methods 
`final`.
