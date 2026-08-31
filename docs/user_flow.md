# User Flows

This document outlines the core user journeys for the Mausam Personalized Homepage MVP.

## A. First-Time User Flow (Cold Start)

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend (API)
    participant E as Engine
    
    U->>F: Opens App
    F->>F: Generate device_id (local)
    F->>B: GET /homepage?device_id=123&lat=28.6&lon=77.2
    B->>E: Assemble standard ContextFrame
    E-->>B: Return default Ranking
    B-->>F: HomepageResponse (Cards)
    F-->>U: Render sensible default homepage
    F-->>U: Show optional "Personalize" prompt
```

## B. Preferences Update Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant DB as Backend Database
    participant E as Engine
    
    U->>F: Opens Persona Settings
    U->>F: Selects "Health + Fitness"
    F->>DB: PUT /preferences {device_id: '123', personas: ['health', 'fitness']}
    DB-->>F: OK
    F->>B: GET /homepage?device_id=123&lat=28.6&lon=77.2
    B->>E: Assemble ContextFrame (w/ Health, Fitness)
    E-->>B: Return new Ranking
    B-->>F: HomepageResponse (New Order)
    F-->>U: Animate cards to new ranking
```

## C. Explanation Interaction Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend (API)
    
    U->>F: Taps AQI Card
    F->>B: GET /explain?ref=exp_aqi_123
    B-->>F: ExplainResponse (Text, Signal Refs)
    F-->>U: Opens Bottom Sheet ("Based on AQI 165")
```

## D. Severe Warning Override

```mermaid
sequenceDiagram
    participant F as Frontend
    participant B as Backend (API)
    participant E as Engine
    
    F->>B: GET /homepage
    B->>E: Assembly
    Note right of E: System detects Cyclone Warning
    E->>E: Hard-rule (P0) override
    E-->>B: Returns override array + normal cards
    B-->>F: {warnings_override: [...], cards: [...]}
    F-->>U: Render Red Cyclone Banner AT TOP
    F-->>U: Render normal cards below
```

## E. Degraded Data Behavior

```mermaid
sequenceDiagram
    participant B as Backend
    participant A as Adapter (e.g. UV)
    participant E as Engine
    participant F as Frontend
    
    B->>A: fetch UV
    A-->>B: Timeout / DB Cache Hit
    B->>E: UV: {value: 9, source: "cached"}
    E-->>B: Card {source: "cached"}
    B-->>F: Card {badge: "As of 14:00"}
    F-->>U: Renders card with explicit freshness badge
```
