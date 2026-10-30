import SwiftUI
import WidgetKit
import AppIntents

@available(iOS 17.0, *)
struct ToggleOSFitExercise: AppIntent {
    static var title: LocalizedStringResource = "Отметить упражнение"
    static var openAppWhenRun = false
    @Parameter(title: "Идентификатор упражнения") var exerciseID: String
    init() {}
    init(id: String) { exerciseID = id }
    func perform() async throws -> some IntentResult {
        var workout = OSFitStore.load()
        guard let index = workout.exercises.firstIndex(where: { $0.id == exerciseID }) else { return .result() }
        workout.exercises[index].completed.toggle()
        OSFitStore.save(workout)
        return .result()
    }
}

struct OSFitEntry: TimelineEntry {
    let date: Date
    let workout: MiniWorkout
}
struct OSFitProvider: TimelineProvider {
    func placeholder(in context: Context) -> OSFitEntry {
        OSFitEntry(date: .now, workout: MiniWorkout(name: "Тренировка A", exercises: [
            MiniExercise(id: "1", name: "Жим лёжа", completed: false),
            MiniExercise(id: "2", name: "Присед", completed: true),
            MiniExercise(id: "3", name: "Тяга", completed: false)]))
    }
    func getSnapshot(in context: Context, completion: @escaping (OSFitEntry) -> Void) {
        completion(OSFitEntry(date: .now, workout: OSFitStore.load()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<OSFitEntry>) -> Void) {
        completion(Timeline(entries: [OSFitEntry(date: .now, workout: OSFitStore.load())], policy: .never))
    }
}

@available(iOS 17.0, *)
struct OSFitWidgetView: View {
    let entry: OSFitEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("OSFIT").font(.caption.bold()).foregroundStyle(.blue)
                    Text(entry.workout.name).font(.subheadline.bold()).lineLimit(1)
                }
                Spacer()
                Text("\(entry.workout.completed)/\(entry.workout.exercises.count)")
                    .font(.subheadline.bold()).foregroundStyle(.blue)
            }
            ProgressView(value: Double(entry.workout.completed), total: Double(max(entry.workout.exercises.count, 1)))
                .tint(.blue)
            ForEach(Array(entry.workout.sorted.prefix(5))) { exercise in
                HStack(spacing: 8) {
                    Text(exercise.name).font(.caption).lineLimit(1)
                        .strikethrough(exercise.completed)
                        .foregroundStyle(exercise.completed ? .secondary : .primary)
                    Spacer(minLength: 4)
                    Button(intent: ToggleOSFitExercise(id: exercise.id)) {
                        Image(systemName: exercise.completed ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(exercise.completed ? .blue : .secondary)
                    }.buttonStyle(.plain)
                }
            }
            Spacer(minLength: 0)
        }.containerBackground(.background, for: .widget)
    }
}

@available(iOS 17.0, *)
struct OSFitWidget: Widget {
    let kind = "OSFitWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: OSFitProvider()) { entry in
            OSFitWidgetView(entry: entry)
        }
        .configurationDisplayName("OSFIT · Тренировка")
        .description("Отмечай упражнения прямо с экрана iPhone")
        .supportedFamilies([.systemLarge])
    }
}

@main
struct OSFitWidgetBundle: WidgetBundle {
    var body: some Widget { OSFitWidget() }
}
