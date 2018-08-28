---
layout: post
title: Never make classes final
date: 2018-08-27T17:00:00+03:00
---

The class of any Elegant object must be either 
[abstract or final](https://www.yegor256.com/2014/11/20/seven-virtues-of-good-object.html#7-his-class-is-either-final-or-abstract).
The intention behind this rule, I believe, was eliminating implementation inheritance as a kind. Drawbacks of 
inheritance and behefits of subtyping are rather [clear](https://www.yegor256.com/2016/09/13/inheritance-is-procedural.html), 
so I won't make an accent on them. However, in my practice I quickly realized that something is wrong with this rule.

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

```
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

<img src="http://latex.codecogs.com/gif.latex?N_{Input}\times N_{Output}" border="0"/>

Where N is the number of the class implementations. The number is growing with:
- any new class attribute: this will add a new N to the equation above. Such thing as "new attribute" is less likely to 
happen with highly-cohesive and single-responcible class like `TeeInput` but still it is possible.
- any new subtype of the existing attribute's type---this on the other hand is typical situation for a 
highly-segregated interfaces like `Input` and `Output`.

Both this factors cause exhaustive number of constructors growing very quick, so 72 is not a limit. 
One may contradict that there is no need to define the exhaustive set of constructors, and it is true.
But when one need a constructor which is not defined, they will face another issue.

### The class is unextendable

Okay, we have `TeeInput` with dozens constructors. Now imagine that some developer took Cactoos framework and defined
a new subtype of `Input` over his own framework. Lets name it `InputFromUniverse`. What it actually does inside---doesn't matter. 

The developer started composing it with different classes from Cactoos and noticed that some part of 
composition with `TeeInput` taking `InputFromUniverse` repeats very often and its source code is too big. In that case he would have a 
great temptation to eliminate the duplication---all he needs is a new secondary constructor for `TeeInput`, taking 
`InputFromUniverse` attributes and `Output`...
 
But the class is final. It is sealed and unextendable.

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
    public TeeInputFromWebToFile(final URI uri, final File file) {
        super(new InputFromUri(uri), new OutputToFile(file));
    }
}

public class TeeInputFromFileToFile extends TeeInput {
    public TeeInputFromFileToFile(final File input, final File file) {
        super(new InputFromFile(input), new OutputToFile(file));
    }
}

public class TeeInputFromUniverse extends TeeInput {
    public TeeInputFromFileToFile(final UniverseCoordinates universeCoordinates, final Output output) {
        super(new InputFromUniverse(universeCoordinates), output);
    }
}
```

Is it implementation inheritance? Maybe. But the more important question is: can we call these inheritors 
*subtypes* of `TeeInput`?

Look closer. All these inheritors have an interesting capability. *For any composition which operates 
with such inheritor, replacement of it with the contents of its constructor would never change the composition's 
behavior*. For example, these two objects are equivalent:

```
new TeeInputFromUrlToFile(
    "http://example.com/somefile",
    new File("/tmp/tempFile")
)
```
...vs...
```
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
[familiar](https://en.wikipedia.org/wiki/Liskov_substitution_principle)?

This equivalence might be easily broken though if one overrode the `stream` method in `TeeInput` inheritor. To 
prevent that, the method is intentionally made final. This will force the inheritors to inherit a class as a whole, 
not only parts of them.

The concept of reusing the class in such manner may look similar to 
[decorating envelopes](https://www.yegor256.com/2017/01/31/decorating-envelopes.html) approach. It's really nice 
approach, but what I can't get is why should we prohibit applying it on honest "Elegant" class by making it `final`?

Never make "Elegant" classes `final`---it is harmful and gives no benefits. Instead---make all its methods `final`.
