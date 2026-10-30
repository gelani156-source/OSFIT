import Foundation
import WidgetKit

// Add this file to BOTH the host app and Widget Extension targets.
// Enable the same App Group for both targets and replace the example ID.
enum OSFitStore {
    static let groupID = "group.example.osfit" // REPLACE with an owned App Group ID
    static let key = "currentWorkout"
    static var defaults: UserDefaults? { UserDefaults(suiteName: groupID) }

    static func load() -> MiniWorkout {
        guard let data = defaults?.data(forKey: key),
              let workout = try? JSONDecoder().decode(MiniWorkout.self, from: data)
        else { return MiniWorkout(name: "Нет активной тренировки", exercises: []) }
        return workout
    }
    static func save(_ workout: MiniWorkout) {
        guard let data = try? JSONEncoder().encode(workout) else { return }
        defaults?.set(data, forKey: key)
        WidgetCenter.shared.reloadTimelines(ofKind: "OSFitWidget")
    }
}

struct MiniExercise: Codable, Identifiable {
    var id: String
    var name: String
    var completed: Bool
}
struct MiniWorkout: Codable {
    var name: String
    var exercises: [MiniExercise]
    var completed: Int { exercises.filter(\.completed).count }
    var sorted: [MiniExercise] {
        exercises.enumerated().sorted {
            if $0.element.completed == $1.element.completed { return $0.offset < $1.offset }
            return !$0.element.completed
        }.map(\.element)
    }
}
