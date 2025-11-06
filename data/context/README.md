# Business Context System

This directory contains business intelligence that your AI agent uses to provide contextual advice and maintain brand consistency.

## Files

### `marcus-persona.json`
Your primary target audience persona - a 34-year-old career changer named Marcus Rivera. Contains:
- Demographics and background
- Deep desires and motivations
- Major obstacles and fears
- Internal voice (doubts/questions)
- What he's searching for
- Emotional landscape
- Content triggers (hook words vs turnoff words)
- Learning journey phases

### `business-overview.json`
Your business strategy and content guidelines. Contains:
- Mission and value proposition
- Target audience demographics
- Content pillars (4 main themes)
- Brand voice guidelines
- Content structure templates
- What to emphasize/avoid

## How the Agent Uses This

The agent has two specialized tools:

### 1. `getBusinessContextTool`
Used when you ask for:
- Business strategy advice
- Content planning
- Audience analysis
- Marketing insights
- "Should I write about X?"
- "What does my audience care about?"

### 2. `searchWritingSamplesTool`
Used when you ask to:
- Write an article/post
- Draft content
- Match your writing style
- Reference past work

## Adding More Context

You can add more JSON files to this directory:
- `content-calendar.json` - upcoming content themes
- `competitor-analysis.json` - positioning insights
- `brand-guidelines.json` - visual/tone specifics
- `target-audience-segments.json` - other persona types

Update the `getBusinessContextTool` to load additional context types as needed.

## Usage Examples

**Business Advice:**
```
"Should I create content about learning Python vs JavaScript for Marcus?"
→ Agent retrieves Marcus persona, analyzes his needs, gives recommendation
```

**Content Creation:**
```
"Write a LinkedIn post about avoiding tutorial hell"
→ Agent searches your previous writing samples + Marcus context
→ Writes in your voice while addressing Marcus's pain points
```

**Strategy:**
```
"What content themes should I focus on this quarter?"
→ Agent reviews business overview, content pillars, and Marcus persona
→ Suggests aligned topics with rationale
```
