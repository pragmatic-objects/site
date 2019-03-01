---
layout: post
title: The core principles of software design
description: The shortest self-sufficient set of principles for making software design maintainble.
date: 2019-02-27T00:00:00+03:00
---

What makes software design [maintainable](https://en.wikipedia.org/wiki/Maintainability)? Nicely expressed logic by means of powerful language and 
its [syntactic sugar](https://en.wikipedia.org/wiki/Syntactic_sugar)? 
Absence of boilerplate code? Tight [cohesion](https://en.wikipedia.org/wiki/Cohesion_(computer_science)) and loose [coupling](https://en.wikipedia.org/wiki/Coupling_(computer_programming))?
Using [design patterns](https://en.wikipedia.org/wiki/Software_design_pattern) and avoiding [antipatterns](https://en.wikipedia.org/wiki/Anti-pattern)?
[Speaking names](https://www.yegor256.com/2014/11/20/seven-virtues-of-good-object.html#1-he-exists-in-real-life) for classes, methods and variables?

For me, none of above anymore. Well, at least not directly. They are useful and handy from time to time, but they guarantee nothing, and are hard for objective reasoning.
Deeply sugarized languages tend to be more complex for reading and studying and [harder](https://www.yegor256.com/2017/04/11/flexibility-equates-lower-quality.html) for enforcing quality standards.
Excessive use of design patterns often leads to overdesign. There are [decades](http://www.math.md/files/csjm/v25-n1/v25-n1-(pp44-74).pdf) of metrics for estimating cohesion
and coupling and none of them are accurate enough to make desicions. And certain "speaking" names could mean completely different things within different contexts.

We all feel the pain when the code we maintain is a mess, but what means "a mess" we usually can't formulate presicely.

I found for myself the best, smallest, simplest and the most universal criteria of maintainability. And it works especially flawless with Elegant Objects.

## Notice

Once upon a time Robert C. Martin introduced a fascinating set of [principles](http://butunclebob.com/ArticleS.UncleBob.PrinciplesOfOod)
and [metrics](https://linux.ime.usp.br/~joaomm/mac499/arquivos/referencias/oodmetrics.pdf) for object oriented design. I recommend you to read them.

The principles I will present here are refined and generalized version of principles, presented by Uncle Bob.

## Theory

The core principles I outlined are the following:

1. Each self-sufficient reusable component of some software should be either abstract or concrete.
2. Abstract components are good at defining a purpose of application and intentions of its parts, while concrete components are good for implementing end-user software requirements.
3. Abstract components should be stable, while concrete components should be easy to change.
4. Abstract components should never depend on concrete components.

Actually --- that's all one needs to know about design. In order to apply these principles, the only thing remains is to decide how abstract or concrete is each component of your system, and constrain it accordingly.
Everything else --- patterns, antipatterns, paradigms and misconceptions, language constructs and frameworks features --- either derive this core idea
and help developers to follow it, or lead to troubles, especially when misunderstood.

The principles I outlined above are applicable on any system, consisting of reusable self-sufficient pieces of code. These pieces could be anything --- classes/interfaces, procedures, functions,
libraries, modules, or even processes and microservices: if they can be reused in several places of system, they are the source of same design troubles. Reuse is impossible without coupling, and
coupling always makes system maintenance harder to some degree. By following these four principles, you can keep impact on maintenance from coupling at a minimum.

### How these principles are applicable to Elegant Objects?

Since this blog is about Elegant Objects, lets see how these principles are applied there.

In "Elegant Objects" way of OOP, there are two kinds of self-sufficient components (interfaces and classes) and two kinds of dependencies between them (subtyping and reference).
Which of the components are abstract and which --- concrete?

Interfaces are definitely abstractions. They were initially created for being reused, extended and depend on. Which makes them good for describing the purpose of
application and its components.

There is a bit more complicated story with classes though. They can be abstract or concrete, depending on situation.

Majority of elegantly-designed classes are abstract components. The most representative example are decorator classes:

```java
class TrimmedText implements Text {
    private final Text origin;

    public TrimmedText(final Text text) {
        this.origin = text;
    }

    @Override
    public final String read() {
        return this.origin.read().trim();
    }
}
```

For abstract components, the number of dependencies on other things should be constrained and close to zero, to keep them stable. `TrimmedText` from example above has dependency only on `Text` interface.
Usually, each abstract component is bound to certain fixed intention, or reason to exist (`TrimmedText`'s intention is to trim the text).
Since the intention is fixed, and since there is no dependencies on volatile things, they stay stable and are safe for reuse.

Concrete components are the other story. Examples of such classes are entry points with `main` method (like this class from 
[Takes](https://github.com/yegor256/takes/blob/4c4ce5d834790fd275974969d21f3d7f8dbdc933/src/it/file-manager/src/main/java/org/takes/it/fm/App.java)), 
and classes which make large object compositions (like this class from [Rultor](https://github.com/yegor256/rultor/blob/1.34/src/main/java/com/rultor/agents/Agents.java)).
They are typically full of dependencies, but almost never reused.

Concrete classes are good for collecting things together in one working application. Composing different intentions, each of them fulfill
certain functional requirement. Since dependencies on concrete classes are constrained, they can be changed without fear that changes will break software
in unusual places. Which is virtue for them, because functional requirements are usually the most volatile thing in software development.

## Practice

Meet [Puzzlerbot](https://github.com/skapral/puzzlerbot). Puzzlerbot is a small tool of mine, which provides alternative means for making 
[puzzle tasks](https://www.yegor256.com/2010/03/04/pdd.html). Instead of looking for puzzles in code comments, Puzzlerbot seeks them in comments to closed issues and pull requests.
Below, I'll describe step by step how all these principles were applied for Puzzlerbot development.

### Purpose

First --- we need a purpose. Note that purpose is something very different from software requirements. While requirements are changing every day with business demands,
purpose usually stays put. [AAA](https://en.wikipedia.org/wiki/AAA_(video_game_industry)) videogame would never turn into banking system. IoT-based solution wouldn't mutate to online shop.
Requirements for them may change drastically during their development lifetime, but not the purpose.
Attempt to change a purpose of some living application usually causes unreasonably huge and severe impacts and costs. So huge that it is easier to just write it from scratch.

In other words, purpose of the application is like a [log line](https://en.wikipedia.org/wiki/Log_line) to a film,
while software requirements are like plot. In case of Puzzlerbot, the purpose is:

- to find puzzles in certain places
- parse the puzzles
- store the puzzles as issues to some issue tracker

Note that the purpose is never bound to details. Simply because details are a source of volatility. I don't claim yet what exactly are these
places and issue trackers Puzzlerbot must deal with. It's irrelevant yet.

### Abstractions

Purpose is defined. Great. Now we can outline some abstractions.

In order to find puzzles in certain places like GitHub issues or pull requests, we need an abstraction for these certain places.
In my case, it is [`PuzzleSource`](https://github.com/skapral/puzzlerbot/blob/433dd1c2591bfb931bbbe30967c1c3118add7c09/puzzler-core/src/main/java/com/github/skapral/puzzler/core/PuzzleSource.java):

```java
public interface PuzzleSource {
    List<Puzzle> puzzles();
}
```

In order to parse puzzle contents, we need some abstraction for representing the puzzle.
In my case, it is [`Puzzle`](https://github.com/skapral/puzzlerbot/blob/433dd1c259/puzzler-core/src/main/java/com/github/skapral/puzzler/core/Puzzle.java):

```java
public interface Puzzle {
    String title();
    String description();
}
```

In order to store the puzzle as issue to some issue tracker, I need an abstraction for that issue tracker.
In my case, it is [`IssueTracker`](https://github.com/skapral/puzzlerbot/blob/433dd1c259/puzzler-core/src/main/java/com/github/skapral/puzzler/core/IssueTracker.java):
```java
public interface IssueTracker {
    void persistPuzzle(Puzzle puzzle);
}
```

And in order to make all these things work together,
I need a [class](https://github.com/skapral/puzzlerbot/blob/433dd1c259/puzzler-core/src/main/java/com/github/skapral/puzzler/core/operation/OpPersistAllPuzzles.java) that will do it for me:

```java
/**
 * Operation that persists all puzzles from the provided source to the
 * issue tracker.
 */
public class OpPersistAllPuzzles implements Operation {
    private final PuzzleSource puzzleSource;
    private final IssueTracker issueTracker;

    public OpPersistAllPuzzles(PuzzleSource puzzleSource, IssueTracker issueTracker) {
        this.puzzleSource = puzzleSource;
        this.issueTracker = issueTracker;
    }

    @Override
    public final void execute() {
        puzzleSource.puzzles().forEach(issueTracker::persistPuzzle);
    }
}
```

Despite the fact that `OpPersistAllPuzzles` is a non-abstract class, from design point of view it is an abstract component, because it is stable,
bound to purpose of Puzzlerbot and doesn't depend on any implementation details.

Note the core characteristics of abstractions. First of all, each of them is stable. It is hard to imagine requirement change, that would impact any of these components.
Also, Since they are stable, I can safely rely on them. As well as I can imagine infinite number of different puzzle sources and issue trackers to support in future, 
I can derive infinite number of classes from `Puzzle`, `IssueTracker` or `PuzzleSource` without fear that abstractions will change at some time.
This brings great potential for extending Puzzlerbot's capabilities.

### From abstractions to concrete details

Core abstractions are defined. Splendid. Now I can analyse requirements step-by-step and make several implementations.

Currently, Puzzlerbot parses closed Github issues and pull requests 
(which gives us [`PsrcFromGithubEvent`](https://github.com/skapral/puzzlerbot/blob/433dd1c259/puzzler-github/src/main/java/com/github/skapral/puzzler/github/source/PsrcFromGithubEvent.java))
and stores issues back to GitHub
([`ItGithubIssues`](https://github.com/skapral/puzzlerbot/blob/master/puzzler-github/src/main/java/com/github/skapral/puzzler/github/itracker/ItGithubIssues.java)).
Also, comment with puzzle is supposed to have certain format (see [README.md](https://github.com/skapral/puzzlerbot/blob/433dd1c259/README.md#how-to-create-a-puzzle)
and [`PzlUsingThreeParsText`](https://github.com/skapral/puzzlerbot/blob/433dd1c259/puzzler-core/src/main/java/com/github/skapral/puzzler/core/puzzle/PzlUsingThreeParsText.java)).

All components I mentioned above are abstract. Each of them is bound to specific intention: `PsrcFromGithubEvent` --- to get
list of puzzles from incoming [GitHub webhook](https://developer.github.com/webhooks/) event, `ItGithubIssues` --- to persist puzzles to GitHub issues, `PzlUsingThreeParsText` --- to parse
puzzle's title and description from plain text. Since the intentions are stable, the classes are stable too --- one can safely reuse them wherever they are needed.

Finally, in the end, I defined HTTP endpoint for catching GitHub issues/PRs close events
([`GithubHookEndpoint`](https://github.com/skapral/puzzlerbot/blob/master/puzzler-web/src/main/java/com/github/skapral/puzzler/web/jersey/GithubHookEndpoint.java))
and composed everything together in it.

```java
@Path("github")
public class GithubHookEndpoint {
    @POST
    @Consumes("application/json")
    @Produces("application/json")
    public final Response githubHook(@HeaderParam("X-GitHub-Event") final String eventType, @HeaderParam("X-Hub-Signature") final String eventSignature, final String event) throws Exception {
        new OpValidatingGithubEventSignature(
            new Cp_GITHUB_HOOK_SECRET(),
            event,
            Objects.isNull(eventSignature) ? "" : eventSignature,
            new OpIgnoringUnprivildgedEventSender(
                event,
                new OpPersistAllPuzzles(
                    new PsrcFromGithubEvent(
                        eventType,
                        event,
                        new Cp_GITHUB_AUTH_TOKEN()
                    ),
                    new ItGithubIssues(
                        new GhapiProduction(
                            new Cp_GITHUB_AUTH_TOKEN()
                        ),
                        new GprjFromGithubEvent(
                            event
                        )
                    )
                )
            ),
            AuthenticationException::new
        ).execute();
        return Response.ok("{}").build();
    }
}
```

`GithubHookEndpoint` is the example of concrete component in Puzzlerbot. It is *never* reused, and is never *supposed* to be reused. At the same time, since it is not a subject for reuse,
I am free to depend on *anything* there. I can even do one step out of Elegant Objects paradigm and use [annotation-based](https://www.yegor256.com/2016/04/12/java-annotations-are-evil.html)
JAX-RS framework. Who cares that the endpoint is deeply and implicitly bound to JAX-RS by annotations, if [Jersey](https://jersey.github.io/) framework is 
the only place which is supposed to use it?

Also, `GithubHookEndpoint` is extremely volatile, which is a good thing for concrete component. No matter how handling of GitHub events would change in Puzzlerbot, I can make changes in
`GithubHookEndpoint` easily, and not afraid of breaking other components. Simply because there are no other components to break. There are no depenedencies on it.

### What practical benefits these principles give?

Transparency.

First of all, by following these principles, for each incoming change request it is clear from the start how much it costs. If change request
impacts some abstraction, the cost will be as large, as much there are dependencies on that abstraction. Usually, it is not hard to check it on earliest of development stages.
And since abstractions are bound to the purpose of application, it is usually easier to explain this costs to stakeholders, who don't like the word "refactoring".

Second, it is easier to work in parallel on code organized in such way. The chance that by working on different features developers will impact same components
(causing merge conflicts) is close to zero. For example, when I [added](https://github.com/skapral/puzzlerbot/pull/74) Puzzlerbot support for GitLab,
I did almost none changes in already written code.

Third, the code readability increases drastically. Not only I [don't use class names which ends on -ER](https://www.yegor256.com/2015/03/09/objects-end-with-er.html),
I never feel a need to do so. Because each and every class is bound either to application's purpose, or intention, forulated in human language.
From the first glance on the class name it is clear what the class is supposed to do.

Forth, it is self-protecting. Once I realise that I am about to make changes in some component that was supposed to stay abstract, it's a clear indicator for me that I 
missed something in the beginning, when I outlined abstraction in first place. Good reason to make some root-cause analysis and refactoring.

Fifth, it is easy! Look --- just four straight principles instead of great load of patterns, paradigms, approaches, options, capabilities, frameworks and books about them!
You can just throw away your heavy annotation-based framework or container which gives you only promises of clear design, and do clear design yourself!
You can throw out of head all nuances of how it's internal black magic works and use free brain resources for studying domain area of your application, 
in order to better understand the needs of your users and stakeholders. Knowledge of domain area is much more helpful for building adequate abstractions than knowledge of how your
favorite DI container processes `@Inject` annotation.

### To sum up

Abstract components are components for being reused, while concrete components are components for reusing other components.

Abstract components must be stable, while concrete components must be volatile.

Abstract components define purpose, while concrete components implement requirements.

These two categories should never be mixed. Every self-sufficient piece of code must be either abstract, or concrete.

